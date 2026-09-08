#!/usr/bin/env python3
"""Inspect an official IRCC PDF template for PoC A (read-only, no modification)."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError as exc:  # pragma: no cover
    raise SystemExit("PyMuPDF (fitz) is required: pip install pymupdf") from exc


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def detect_xfa(raw: bytes) -> dict:
    text = raw.decode("latin-1", errors="ignore")
    has_xfa_keyword = "/XFA" in text or "xfa:" in text.lower()
    dynamic = "/NeedAppearances" in text or "NeedRendering" in text
    return {
        "xfa_keyword_present": has_xfa_keyword,
        "needs_appearances_or_rendering_hint": dynamic,
    }


def inspect_pdf(path: Path) -> dict:
    raw = path.read_bytes()
    doc = fitz.open(stream=raw, filetype="pdf")

    fields: list[dict] = []
    for page_index in range(doc.page_count):
        page = doc.load_page(page_index)
        for widget in page.widgets() or []:
            fields.append(
                {
                    "page": page_index + 1,
                    "field_name": widget.field_name,
                    "field_label": widget.field_label,
                    "field_type": widget.field_type_string,
                    "field_value": widget.field_value,
                }
            )

    meta = doc.metadata or {}
    encrypted = doc.is_encrypted
    sigflags = doc.get_sigflags()

    report = {
        "file": str(path),
        "byte_size": len(raw),
        "sha256": sha256_file(path),
        "pdf_version_header": raw[:16].decode("latin-1", errors="ignore").strip(),
        "page_count": doc.page_count,
        "encrypted": encrypted,
        "signature_flags": sigflags,
        "metadata": meta,
        "xfa": detect_xfa(raw),
        "acroform_widget_count": len(fields),
        "fields_sample": fields[:50],
        "all_field_names": [f["field_name"] for f in fields if f.get("field_name")],
    }

    doc.close()
    return report


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: inspect_pdf.py <template.pdf> [output.json]", file=sys.stderr)
        return 1

    pdf_path = Path(sys.argv[1]).resolve()
    if not pdf_path.exists():
        print(f"File not found: {pdf_path}", file=sys.stderr)
        return 1

    report = inspect_pdf(pdf_path)
    output = json.dumps(report, indent=2, ensure_ascii=False)
    print(output)

    if len(sys.argv) >= 3:
        out_path = Path(sys.argv[2]).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output, encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
