#!/usr/bin/env python3
"""Dump every leaf value from filled IMM5669 datasets."""
from __future__ import annotations

import re
from pathlib import Path
import sys

sys.path.insert(0, "form-processor-poc/python")
from pypdf import PdfReader
from validate_pdfxfa_output import extract_datasets_xml

folder = sorted(
    Path("docs/government-forms-poc").glob("adobe-live-check-*"),
    key=lambda p: p.stat().st_mtime,
    reverse=True,
)[0]
pdf = folder / "IMM5669-adobe-check.pdf"
reader = PdfReader(str(pdf))
reader.decrypt("")
xml = extract_datasets_xml(reader) or ""
print("FILE", pdf)
print(xml)
print("\nAll text nodes with hyphens:")
for m in re.finditer(r">([^<]*-[^<]*)<", xml):
    print(repr(m.group(1)))
