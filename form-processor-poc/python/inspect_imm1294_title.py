#!/usr/bin/env python3
from pathlib import Path
import re

t = Path(
    "backend/storage/app/private/government-forms-poc/reports/xfa-imm1294/template.xml"
).read_text(encoding="utf-8", errors="ignore")

for label in [
    "SCHEDULE A",
    "BACKGROUND / DECLARATION",
    "BACKGROUND/DECLARATION",
    "Personal details of your mother",
    "1. UCI",
    "Application Details",
]:
    print(label, "->", t.find(label))

# show form title draws
for m in re.finditer(r"<text\s*>\s*(SCHEDULE[^<]{0,80}|BACKGROUND[^<]{0,80}|IMM[^<]{0,40})</text\s*>", t, flags=re.I):
    print("TITLE:", m.group(1))
