#!/usr/bin/env python3
"""Export IMM1294 / IMM1295 / IMM5707 datasets skeletons from official templates."""

from __future__ import annotations

import re
import sys
from pathlib import Path

from pypdf import PdfReader

from validate_pdfxfa_output import extract_datasets_xml


def collapse(body: str, root: str) -> str:
    body = re.sub(
        rf"<{root}(?:\s[^>]*)?>",
        f'<{root} xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/">',
        body,
        count=1,
    )
    body = re.sub(rf"</{root}\s*>", f"</{root}>", body, count=1)
    body = re.sub(r"\s*\n\s*(/?>)", r"\1", body)
    body = re.sub(r">\s*\n\s*<", "><", body)
    return body


def export_root(tpl: Path, out: Path, root: str) -> int:
    reader = PdfReader(str(tpl))
    if reader.is_encrypted:
        reader.decrypt("")
    xml = extract_datasets_xml(reader) or ""
    match = re.search(rf"<{root}(?:\s[^>]*)?>[\s\S]*?</{root}\s*>", xml)
    if not match:
        print(f"{root} root not found in {tpl}", file=sys.stderr)
        return 1
    body = collapse(match.group(0), root)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + body + "\n", encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    return 0


def main() -> int:
    repo = Path(__file__).resolve().parents[2]
    official = repo / "backend/storage/app/private/government-forms-poc/templates/official"
    fixtures = repo / "form-processor-poc/fixtures"

    jobs = [
        (official / "imm1294-official-394c745501ef.pdf", fixtures / "imm1294_datasets_skeleton.xml", "form1"),
        (official / "imm1295-official-57fc256eef7d.pdf", fixtures / "imm1295_datasets_skeleton.xml", "form1"),
        (official / "imm5707-official-6e59d35048ef.pdf", fixtures / "imm5707_datasets_skeleton.xml", "IMM_5707"),
    ]
    rc = 0
    for tpl, out, root in jobs:
        if not tpl.exists():
            print(f"missing template {tpl}", file=sys.stderr)
            rc = 1
            continue
        rc = export_root(tpl, out, root) or rc
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
