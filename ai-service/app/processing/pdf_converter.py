"""Convert PDF uploads to a raster image for OCR (first page only)."""

from __future__ import annotations

import io

import fitz  # PyMuPDF
from PIL import Image


def pdf_first_page_to_png_bytes(pdf_bytes: bytes, dpi: int = 200) -> bytes:
    """Render page 1 of a PDF to PNG bytes suitable for OpenCV/EasyOCR."""
    if not pdf_bytes.startswith(b"%PDF"):
        raise ValueError("Not a valid PDF file.")

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if doc.page_count == 0:
            raise ValueError("PDF has no pages.")

        page = doc.load_page(0)
        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=matrix, alpha=False)

        if pix.n >= 3:
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        else:
            img = Image.frombytes("L", (pix.width, pix.height), pix.samples).convert("RGB")

        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    finally:
        doc.close()
