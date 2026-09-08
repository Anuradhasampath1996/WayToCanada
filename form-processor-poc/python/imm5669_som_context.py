#!/usr/bin/env python3
from pathlib import Path
import re

text = Path(
    r"f:\WayToCanada\WayToCanada\backend\storage\app\private"
    r"\government-forms-poc\reports\xfa-imm5669\template.xml"
).read_text(encoding="utf-8", errors="replace")

for label in ("familyName", "givenName", "birthDate3", "nameOfApplicant"):
    m = re.search(rf'name="{label}"', text)
    if not m:
        print(label, "NOT FOUND")
        continue
    start = max(0, m.start() - 600)
    snippet = text[start : m.start() + 100].replace("\n", " ")
    opens = re.findall(r'<(subform|field|exclGroup)\s+[^>]*name="([^"]+)"', snippet)
    print(label, "->", " / ".join(f"{a}:{b}" for a, b in opens[-8:]))

print("root names", re.findall(r'<(?:subform|template)\s+name="([^"]+)"', text[:2000])[:20])
