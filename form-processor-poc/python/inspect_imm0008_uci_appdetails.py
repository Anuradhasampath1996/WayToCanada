#!/usr/bin/env python3
from pathlib import Path
import re

t = Path(
    "backend/storage/app/private/government-forms-poc/reports/xfa-imm0008/template.xml"
).read_text(encoding="utf-8", errors="ignore")

# find Application Details and nearby UCI
for label in ["Application Details", "1. UCI", "UCI", "Personal Details"]:
    print("\n====", label, "count", t.count(label))

i = t.find("Application Details")
print("\nAround Application Details:\n", t[i : i + 1500].replace("\n", " ")[:1500])

# message table for UCI
for m in re.finditer(r"tableMessages\[[^\]]*(?:UCI|Numeric)[^\]]*\]\s*=\s*\"([^\"]+)\"", t):
    print("MSG", m.group(0)[:200])

# find validate near UCI field
for m in re.finditer(r'name="UCI"[\s\S]{0,2000}', t):
    block = m.group(0)[:1500]
    if "validate" in block.lower() or "Numeric" in block or "picture" in block:
        print("\nUCI FIELD BLOCK:\n", block[:1200])
        break
