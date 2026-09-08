#!/usr/bin/env python3
"""Export IMM_5562 datasets skeleton from official template."""

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
        / "imm5562-official-aeb0b9ae7322.pdf"
    )
    out = repo / "form-processor-poc/fixtures/imm5562_datasets_skeleton.xml"

    if len(sys.argv) > 1:
        tpl = Path(sys.argv[1])
    if len(sys.argv) > 2:
        out = Path(sys.argv[2])

    reader = PdfReader(str(tpl))
    if reader.is_encrypted:
        reader.decrypt("")

    xml = extract_datasets_xml(reader) or ""
    match = re.search(r"<IMM_5562(?:\s[^>]*)?>[\s\S]*?</IMM_5562\s*>", xml)
    if not match:
        print("IMM_5562 root not found", file=sys.stderr)
        return 1

    body = match.group(0)
    body = re.sub(r"<IMM_5562(?:\s[^>]*)?>", '<IMM_5562 xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/">', body, count=1)
    body = re.sub(r"</IMM_5562\s*>", "</IMM_5562>", body, count=1)
    body = re.sub(r"\s*\n\s*(/?>)", r"\1", body)
    body = re.sub(r">\s*\n\s*<", "><", body)

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + body + "\n", encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
