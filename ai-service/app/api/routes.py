"""
routes.py — FastAPI route handlers for the OCR microservice.

Endpoints:
  POST /api/v1/scan-document   — upload image/PDF, get structured data back
  GET  /api/v1/health          — liveness probe
"""

from __future__ import annotations

import os
import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import get_settings
from app.models import ExtractedData, ExtractTextResponse, ScanResponse
from app.processing.pdf_text import pdf_extract_text
from app.processing.classifier import classify_document
from app.processing.image_processor import preprocess_image
from app.processing.ocr_engine import extract_text
from app.processing.parsers.id_card import IDCardParser
from app.processing.parsers.passport import PassportParser
from app.processing.pdf_converter import pdf_first_page_to_png_bytes

logger = logging.getLogger(__name__)
router = APIRouter()

_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

_PDF_CONTENT_TYPES = {
    "application/pdf",
}

_ALLOWED_CONTENT_TYPES = _IMAGE_CONTENT_TYPES | _PDF_CONTENT_TYPES

_DEBUG = os.getenv("DEBUG", "false").lower() == "true"


@router.get("/health", summary="Service health check")
async def health() -> dict:
    return {"status": "ok", "service": "wtc-ocr"}


@router.post(
    "/scan-document",
    response_model=ScanResponse,
    summary="Scan an identity document image and extract structured data",
)
async def scan_document(file: UploadFile = File(...)) -> ScanResponse:
    """
    Accept a document image (JPEG / PNG / WEBP / PDF page 1) and return extracted fields.
    """
    settings = get_settings()
    content_type = (file.content_type or "").lower()

    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type '{file.content_type}'. "
                "Accepted: image/jpeg, image/png, image/webp, application/pdf"
            ),
        )

    file_bytes = await file.read()
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.max_file_size_mb} MB.",
        )

    if content_type in _PDF_CONTENT_TYPES:
        try:
            file_bytes = pdf_first_page_to_png_bytes(file_bytes)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        processed = preprocess_image(file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Image processing failed: {exc}") from exc

    raw_text, confidence = extract_text(processed)
    logger.info("OCR complete — confidence=%.3f  chars=%d", confidence, len(raw_text))

    low_conf = confidence < settings.confidence_threshold
    if not raw_text.strip():
        return ScanResponse(
            status="partial_success",
            document_type="unknown",
            extracted_data=ExtractedData(),
            confidence_score=round(confidence, 3),
            raw_text=raw_text if _DEBUG else None,
            message="Could not read document. Use a clear photo of the bio-data page in good lighting.",
        )

    doc_type = classify_document(raw_text)
    parser = PassportParser() if doc_type == "passport" else IDCardParser()
    extracted = parser.parse(raw_text)

    field_count = sum(1 for v in extracted.model_dump().values() if v)
    if field_count == 0:
        return ScanResponse(
            status="partial_success",
            document_type=doc_type,
            extracted_data=extracted,
            confidence_score=round(confidence, 3),
            raw_text=raw_text if _DEBUG else None,
            message="Document read but no fields found. Ensure the bio-data page fills the frame.",
        )

    if low_conf:
        return ScanResponse(
            status="partial_success",
            document_type=doc_type,
            extracted_data=extracted,
            confidence_score=round(confidence, 3),
            raw_text=raw_text if _DEBUG else None,
            message="Low confidence scan. Please verify all extracted data.",
        )

    return ScanResponse(
        status="success",
        document_type=doc_type,
        extracted_data=extracted,
        confidence_score=round(confidence, 3),
        raw_text=raw_text if _DEBUG else None,
    )


@router.post(
    "/extract-text",
    response_model=ExtractTextResponse,
    summary="Extract plain text from a document for Maple Q&A",
)
async def extract_document_text(file: UploadFile = File(...)) -> ExtractTextResponse:
    """
    Return readable text from PDFs (text layer or OCR fallback) and images.
    Used by the consultant Maple workspace to answer questions about uploaded files.
    """
    settings = get_settings()
    content_type = (file.content_type or "").lower()

    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type '{file.content_type}'. "
                "Accepted: image/jpeg, image/png, image/webp, application/pdf"
            ),
        )

    file_bytes = await file.read()
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.max_file_size_mb} MB.",
        )

    page_count: int | None = None

    if content_type in _PDF_CONTENT_TYPES:
        try:
            text, page_count = pdf_extract_text(file_bytes)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        if len(text.strip()) >= 80:
            return ExtractTextResponse(
                status="success",
                text=text,
                page_count=page_count,
                extraction_method="pdf_text_layer",
            )

        try:
            file_bytes = pdf_first_page_to_png_bytes(file_bytes)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    else:
        text = ""

    try:
        processed = preprocess_image(file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Image processing failed: {exc}") from exc

    raw_text, confidence = extract_text(processed)
    logger.info("Maple extract-text OCR — confidence=%.3f chars=%d", confidence, len(raw_text))

    if not raw_text.strip():
        return ExtractTextResponse(
            status="error",
            text="",
            page_count=page_count,
            extraction_method="ocr",
            confidence_score=round(confidence, 3),
            message="Could not read text from this file. Try a clearer scan or a PDF with selectable text.",
        )

    return ExtractTextResponse(
        status="success",
        text=raw_text.strip(),
        page_count=page_count or 1,
        extraction_method="ocr",
        confidence_score=round(confidence, 3),
    )
