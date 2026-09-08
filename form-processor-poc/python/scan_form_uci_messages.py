#!/usr/bin/env python3
from pathlib import Path

root = Path("backend/storage/app/private/government-forms-poc/reports")
for p in sorted(root.rglob("template.xml")):
    t = p.read_text(encoding="utf-8", errors="ignore")
    flags = []
    if "Application Details" in t or "APPLICATION DETAILS" in t:
        flags.append("ApplicationDetails")
    if "Personal Details" in t:
        flags.append("PersonalDetails")
    if "Numeric characters" in t:
        flags.append("NumericMsg")
    if "UCI" in t:
        flags.append("UCI")
    if "invalid" in t.lower() and "character" in t.lower():
        flags.append("InvalidCharsMsg")
    print(p.parent.name, ",", " ".join(flags) if flags else "-")
