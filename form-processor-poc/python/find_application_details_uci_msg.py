#!/usr/bin/env python3
from pathlib import Path
import re

reports = Path("backend/storage/app/private/government-forms-poc/reports")
for p in sorted(reports.rglob("template.xml")):
    t = p.read_text(encoding="utf-8", errors="ignore")
    if "Application Details-" in t or "-Application Details-" in t or "1. UCI" in t:
        print("\nFILE", p.parent.name)
        for m in re.finditer(
            r"<validate[\s\S]{0,80}<message[\s\S]{0,400}?</message\s*>[\s\S]{0,200}?</validate\s*>",
            t,
            flags=re.I,
        ):
            block = m.group(0)
            if "UCI" in block or "Application Details" in block:
                print(re.sub(r"\s+", " ", block)[:500])
                print("---")

# also search all extracted adobe check related templates for Application Details-
for p in Path("backend/storage/app/private/government-forms-poc/reports").rglob("*.xml"):
    t = p.read_text(encoding="utf-8", errors="ignore")
    if "-Application Details-" in t:
        print("HIT", p)
