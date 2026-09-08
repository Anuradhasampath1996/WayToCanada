#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

base = Path("backend/storage/app/private/government-forms-poc/reports/xfa-imm5669")
for path in sorted(base.glob("*.xml")):
    text = path.read_text(encoding="utf-8", errors="replace")
    if "UCI" in text or "Numeric" in text or "validate" in text.lower() or "script" in text.lower():
        print(f"\n===== {path.name} =====")
    hits = []
    for pat in ["UCI", "Numeric characters", "invalid", "FOSSID", "birthDate3"]:
        if pat in text:
            hits.append(pat)
    if hits:
        print(path.name, "hits", hits)

text = (base / "template.xml").read_text(encoding="utf-8", errors="replace")

# Extract full field definitions for FOSSID and birthDate3 including validate/picture
for field in ["FOSSID", "birthDate3", "familyName", "OriginalLanguage2"]:
    m = re.search(rf'<field[^>]*name="{field}"[\s\S]*?</field>', text)
    if not m:
        print(f"NO FIELD {field}")
        continue
    block = m.group(0)
    print(f"\n##### {field} ({len(block)} chars) #####")
    # print validate / picture / format pieces
    for mm in re.finditer(r"<(validate|picture|format|value|bind|event|script)[\s\S]*?</\1>", block, flags=re.I):
        print(mm.group(0)[:500])
        print("---")
    if "validate" not in block.lower() and "picture" not in block.lower():
        print(block[:800])
