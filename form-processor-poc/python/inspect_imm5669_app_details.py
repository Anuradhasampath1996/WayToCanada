#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

text = Path(
    "backend/storage/app/private/government-forms-poc/reports/xfa-imm5669/template.xml"
).read_text(encoding="utf-8", errors="replace")

# Find Application Details section structure around familyName
i = text.find('name="familyName"')
print(text[max(0, i - 3500) : i + 800])

print("\n\n==== renderCache text runs mentioning numbers / UCI / name")
for m in re.finditer(r'renderCache\.textRun[^?]+\?', text):
    s = m.group(0)
    if any(k in s for k in ("UCI", "full name", "Date of birth", "1.", "2.", "3.", "Application")):
        print(s)
