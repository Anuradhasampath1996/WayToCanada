#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

text = Path(
    "backend/storage/app/private/government-forms-poc/reports/xfa-imm5669/template.xml"
).read_text(encoding="utf-8", errors="replace")

# captions that look like section 1 UCI
for pat in [
    r"1\.\s*UCI",
    r">UCI<",
    r"Unique Client",
    r"Application details",
    r"Application Details",
    r"nameOfApplicant",
    r"clientId",
    r"ClientID",
    r"principalApplicant",
]:
    print("\n====", pat)
    for m in re.finditer(pat, text, flags=re.I):
        print(text[max(0, m.start() - 180) : m.end() + 220].replace("\n", " ")[:520])
        print("---")

# Look for picture/validate scripts mentioning Numeric
print("\n==== numeric validations")
for m in re.finditer(r"Numeric characters|picture=|validate[\s\S]{0,80}script", text, flags=re.I):
    print(text[max(0, m.start() - 120) : m.end() + 180].replace("\n", " ")[:450])
    print("---")
