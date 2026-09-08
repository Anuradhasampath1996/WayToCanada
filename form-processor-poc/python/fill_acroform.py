#!/usr/bin/env python3
"""PoC B helper: fill AcroForm widgets without flattening (PyMuPDF)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import fitz


def fill_pdf(template: Path, output: Path, values: dict[str, str]) -> dict:
    doc = fitz.open(template)
    written: list[str] = []
    missing: list[str] = []

    for page in doc:
        for widget in page.widgets() or []:
            name = widget.field_name
            if name in values:
                widget.field_value = values[name]
                widget.update()
                written.append(name)

    for key in values:
        if key not in written:
            missing.append(key)

    output.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output, incremental=False, encryption=fitz.PDF_ENCRYPT_NONE)
    doc.close()

    return {
        "engine": "pymupdf_acroform",
        "output": str(output),
        "flattened": False,
        "written_fields": written,
        "missing_fields": missing,
    }


def main() -> int:
    if len(sys.argv) < 4:
        print("Usage: fill_acroform.py <template.pdf> <output.pdf> field=value ...", file=sys.stderr)
        return 1

    template = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    values = {}
    for part in sys.argv[3:]:
        if "=" in part:
            k, v = part.split("=", 1)
            values[k] = v

    result = fill_pdf(template, output, values)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
