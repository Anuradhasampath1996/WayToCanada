"""Extract selectable text from PDF uploads (all pages)."""

from __future__ import annotations

import fitz  # PyMuPDF


def pdf_extract_text(pdf_bytes: bytes, max_pages: int = 20) -> tuple[str, int]:
    """Return concatenated text and page count from a PDF."""
    if not pdf_bytes.startswith(b"%PDF"):
        raise ValueError("Not a valid PDF file.")

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page_count = doc.page_count
        if page_count == 0:
            raise ValueError("PDF has no pages.")

        limit = min(page_count, max_pages)
        chunks: list[str] = []
        for index in range(limit):
            page = doc.load_page(index)
            text = (page.get_text() or "").strip()
            if text:
                chunks.append(text)

        return "\n\n".join(chunks).strip(), page_count
    finally:
        doc.close()
