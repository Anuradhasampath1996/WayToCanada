#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

text = Path(
    "backend/storage/app/private/government-forms-poc/reports/xfa-imm5669/template.xml"
).read_text(encoding="utf-8", errors="replace")

scripts = re.findall(r"<script\b[^>]*>([\s\S]*?)</script\s*>", text, flags=re.I)
print(f"script count: {len(scripts)}")
for i, s in enumerate(scripts):
    body = s.strip()
    if not body:
        continue
    print(f"\n--- script {i} ({len(body)} chars) ---")
    print(body[:800])

# also events
events = re.findall(r"<event\b[^>]*>([\s\S]*?)</event\s*>", text, flags=re.I)
print(f"\nevent count: {len(events)}")
for i, e in enumerate(events[:20]):
    if "UCI" in e or "numeric" in e.lower() or "validate" in e.lower() or "-" in e:
        print(f"event {i}:", re.sub(r"\s+", " ", e)[:400])
