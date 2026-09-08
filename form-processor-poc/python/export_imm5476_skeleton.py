#!/usr/bin/env python3
"""Export IMM_5476 XFA datasets data-root skeleton from the official template."""

from __future__ import annotations

import re
import sys
from pathlib import Path

from pypdf import PdfReader

from validate_pdfxfa_output import extract_datasets_xml


def main() -> int:
    repo = Path(__file__).resolve().parents[2]
    tpl = repo / "backend/storage/app/private/government-forms-poc/templates/official/imm5476-official-aca5c476b93d.pdf"
    out = repo / "form-processor-poc/fixtures/imm5476_datasets_skeleton.xml"

    if len(sys.argv) > 1:
        tpl = Path(sys.argv[1])
    if len(sys.argv) > 2:
        out = Path(sys.argv[2])

    reader = PdfReader(str(tpl))
    if reader.is_encrypted:
        reader.decrypt("")

    xml = extract_datasets_xml(reader) or ""
    match = re.search(r"<IMM_5476(?:\s[^>]*)?>[\s\S]*?</IMM_5476\s*>", xml)
    if not match:
        print("IMM_5476 root not found in template datasets", file=sys.stderr)
        print("datasets head:", xml[:200], file=sys.stderr)
        return 1

    # Normalize to a compact, well-formed root tag for PHP DOMDocument.
    body = match.group(0)
    body = re.sub(r"<IMM_5476(?:\s[^>]*)?>", "<IMM_5476>", body, count=1)
    body = re.sub(r"</IMM_5476\s*>", "</IMM_5476>", body, count=1)

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + body + "\n", encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())