"""
routes.py — FastAPI route handlers for the OCR microservice.

Endpoints:
  POST /api/v1/scan-document   — upload image, get structured data back
  GET  /api/v1/health          — liveness probe
"""

from __future__ import annotations

import os
import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import get_settings
from app.models import ExtractedData, ScanResponse
from app.processing.classifier import classify_document
from app.processing.image_processor import preprocess_image
from app.processing.ocr_engine import extract_text
from app.processing.parsers.id_card import IDCardParser
from app.processing.parsers.passport import PassportParser

logger = logging.getLogger(__name__)
router = APIRouter()

_ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

_DEBUG = os.getenv("DEBUG", "false").lower() == "true"


@router.post(
    "/scan-document",
    response_model=ScanResponse,
    summary="Scan an identity document image and extract structured data",
)
async def scan_document(file: UploadFile = File(...)) -> ScanResponse:
    """
    Accept a document image (JPEG / PNG / WEBP) and return extracted fields:
    - Full name
    - Passport number **or** ID number
    - Date of birth  (YYYY-MM-DD)
    - Expiry date    (YYYY-MM-DD)
    - Nationality    (passport only)
    - Gender
    """
    settings = get_settings()

    # ── Validate content type ─────────────────────────────────────────────────
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type '{file.content_type}'. "
                "Accepted: image/jpeg, image/png, image/webp"
            ),
        )

    # ── Read & validate size ──────────────────────────────────────────────────
    image_bytes = await file.read()
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(image_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.max_file_size_mb} MB.",
        )

    # ── Pre-process (OpenCV) ──────────────────────────────────────────────────
    try:
        processed = preprocess_image(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Image processing failed: {exc}") from exc

    # ── OCR (EasyOCR) ─────────────────────────────────────────────────────────
    raw_text, confidence = extract_text(processed)
    logger.info("OCR complete — confidence=%.3f  chars=%d", confidence, len(raw_text))


    # ── Low-confidence fallback ──────────────────────────────────────────────
    low_conf = confidence < settings.confidence_threshold
    if not raw_text.strip():
        return ScanResponse(
            status="partial_success",
            document_type="unknown",
            extracted_data=ExtractedData(),
            confidence_score=round(confidence, 3),
            raw_text=raw_text if _DEBUG else None,
            message="Could not read document. Please use a clearer, well-lit image.",
        )

    # ── Classify ──────────────────────────────────────────────────────────────
    doc_type = classify_document(raw_text)

    # ── Parse structured fields ───────────────────────────────────────────────
    parser = PassportParser() if doc_type == "passport" else IDCardParser()
    extracted = parser.parse(raw_text)

    if low_conf:
        return ScanResponse(
            status="partial_success",
            document_type=doc_type,
            extracted_data=extracted,
            confidence_score=round(confidence, 3),
            raw_text=raw_text if _DEBUG else None,
            message="Low confidence scan. Please verify the extracted data.",
        )

    return ScanResponse(
        status="success",
        document_type=doc_type,
        extracted_data=extracted,
        confidence_score=round(confidence, 3),
        raw_text=raw_text if _DEBUG else None,
    )

