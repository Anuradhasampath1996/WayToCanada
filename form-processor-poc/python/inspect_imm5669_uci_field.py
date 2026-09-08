#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

text = Path(
    "backend/storage/app/private/government-forms-poc/reports/xfa-imm5669/template.xml"
).read_text(encoding="utf-8", errors="replace")

for label in ("UCI", "Application Details", "Your UCI / Client ID", "Client ID"):
    idx = 0
    for _ in range(6):
        i = text.find(label, idx)
        if i < 0:
            break
        print("---", label, "at", i)
        print(text[max(0, i - 250) : i + 350].replace("\n", " ")[:600])
        idx = i + 1

names = re.findall(r"<field[^>]*\bname=\"([^\"]+)\"", text)
print("\nfirst 50 fields:")
for n in names[:50]:
    print(" ", n)

# numeric validation messages
for m in re.finditer(r"Numeric characters|invalid", text, flags=re.I):
    print("validation ctx:", text[max(0, m.start() - 200) : m.end() + 120].replace("\n", " ")[:400])
