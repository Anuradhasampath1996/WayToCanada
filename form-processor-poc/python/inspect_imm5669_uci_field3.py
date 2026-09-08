#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

text = Path(
    "backend/storage/app/private/government-forms-poc/reports/xfa-imm5669/template.xml"
).read_text(encoding="utf-8", errors="replace")

print("UCI count", text.count("UCI"))
for m in re.finditer(r".{0,80}UCI.{0,120}", text):
    print(m.group(0).replace("\n", " "))
    print("---")

# FOSSID field full definition - maybe dual purpose
i = text.find('name="FOSSID"')
print("\nFOSSID block:\n", text[i : i + 2500].replace("\n", "\n")[:2500])

# Look around applicantChoice / application details header
i = text.find("applicantChoice")
print("\napplicantChoice block:\n", text[max(0, i - 800) : i + 1200][:2000])
