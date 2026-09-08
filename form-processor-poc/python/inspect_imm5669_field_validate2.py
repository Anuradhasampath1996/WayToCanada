#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

text = Path(
    "backend/storage/app/private/government-forms-poc/reports/xfa-imm5669/template.xml"
).read_text(encoding="utf-8", errors="replace")

# normalize whitespace a bit for matching
for field in ["FOSSID", "birthDate3", "familyName", "OriginalLanguage2", "fathersBirthDate"]:
    m = re.search(rf'<field\b[^>]*\bname="{field}"[^>]*>[\s\S]*?</field\s*>', text)
    if not m:
        print(f"NO FIELD {field}")
        continue
    block = m.group(0)
    print(f"\n##### {field} ({len(block)} chars) #####")
    for tag in ("validate", "picture", "format", "bind", "script", "event"):
        for mm in re.finditer(rf"<{tag}\b[\s\S]*?</{tag}\s*>", block, flags=re.I):
            print(mm.group(0)[:600])
            print("---")
    # always show caption text
    cap = re.search(r"<caption[\s\S]*?</caption\s*>", block)
    if cap:
        print("CAPTION:", re.sub(r"\s+", " ", cap.group(0))[:300])
