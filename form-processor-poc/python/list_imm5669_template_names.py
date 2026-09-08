#!/usr/bin/env python3
"""List interesting field names from IMM5669 XFA template.xml."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    tpl = Path(
        r"f:\WayToCanada\WayToCanada\backend\storage\app\private"
        r"\government-forms-poc\reports\xfa-imm5669\template.xml"
    )
    if len(sys.argv) > 1:
        tpl = Path(sys.argv[1])
    if not tpl.exists():
        print("missing", tpl, file=sys.stderr)
        return 1

    text = tpl.read_text(encoding="utf-8", errors="replace")
    names = sorted(set(re.findall(r'name="([A-Za-z][A-Za-z0-9_]*)"', text)))
    keys = ("family", "given", "name", "dob", "uci", "email", "birth", "address", "phone", "city", "country", "marital")
    interesting = [n for n in names if any(k in n.lower() for k in keys)]
    print("total_names", len(names))
    print("interesting", len(interesting))
    for n in interesting[:80]:
        print(n)
    print("has_datasets_word", "datasets" in text.lower())
    print("bind_count", len(re.findall(r"<bind", text)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
