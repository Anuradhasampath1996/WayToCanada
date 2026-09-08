#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

text = Path(
    "backend/storage/app/private/government-forms-poc/reports/xfa-imm5669/template.xml"
).read_text(encoding="utf-8", errors="replace")

print("Draw labels / captions with question numbers:")
for m in re.finditer(
    r"<text\s*>\s*([0-9]+\.[^<]{0,80})</text\s*>",
    text,
):
    print("-", m.group(1).strip())

print("\nOriginalLanguage2 caption body:")
i = text.find('name="OriginalLanguage2"')
print(text[i : i + 1800])

print("\nbirthDate3 surrounding labels:")
i = text.find('name="birthDate3"')
print(text[max(0, i - 1200) : i + 200])
