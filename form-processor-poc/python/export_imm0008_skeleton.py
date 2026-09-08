#!/usr/bin/env python3
"""Export form1 XFA datasets skeleton from official IMM0008 template."""

from __future__ import annotations

import re
import sys
from pathlib import Path

from pypdf import PdfReader

from validate_pdfxfa_output import extract_datasets_xml


def main() -> int:
    repo = Path(__file__).resolve().parents[2]
    tpl = (
        repo
        / "backend/storage/app/private/government-forms-poc/templates/official"
        / "imm0008-official-2560489b5716.pdf"
    )
    out = repo / "form-processor-poc/fixtures/imm0008_datasets_skeleton.xml"

    if len(sys.argv) > 1:
        tpl = Path(sys.argv[1])
    if len(sys.argv) > 2:
        out = Path(sys.argv[2])

    reader = PdfReader(str(tpl))
    if reader.is_encrypted:
        reader.decrypt("")

    xml = extract_datasets_xml(reader) or ""
    match = re.search(r"<form1(?:\s[^>]*)?>[\s\S]*?</form1\s*>", xml)
    if not match:
        print("form1 root not found in template datasets", file=sys.stderr)
        print("datasets head:", xml[:200], file=sys.stderr)
        return 1

    body = match.group(0)
    body = re.sub(r"<form1(?:\s[^>]*)?>", '<form1 xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/">', body, count=1)
    body = re.sub(r"</form1\s*>", "</form1>", body, count=1)
    # LiveCycle often emits newlines before '>' / '/>' — normalize for PHP DOMDocument.
    body = re.sub(r"\s*\n\s*(/?>)", r"\1", body)
    body = re.sub(r">\s*\n\s*<", "><", body)

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + body + "\n", encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
