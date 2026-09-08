#!/usr/bin/env python3
"""Quick verify filled values appear in generated Adobe-check PDFs."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "form-processor-poc" / "python"))

from pypdf import PdfReader
from validate_pdfxfa_output import extract_datasets_xml

NEEDLES = [
    "ADOBECHECK",
    "FAMILY",
    "SPOUSE",
    "Singapore",
    "Sinhala",
    "English",
]


def main() -> int:
    root = Path(__file__).resolve().parents[2] / "docs" / "government-forms-poc"
    dirs = sorted(root.glob("adobe-live-check-*"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not dirs:
        print("No adobe-live-check folder found", file=sys.stderr)
        return 1
    folder = dirs[0]
    print(f"Checking {folder}")
    manifest = json.loads((folder / "MANIFEST.json").read_text(encoding="utf-8"))
    rc = 0
    for code, entry in manifest.get("forms", {}).items():
        if not entry.get("ok"):
            print(f"{code}: GENERATE FAIL — {entry.get('error')}")
            rc = 1
            continue
        pdf = Path(entry["adobe_copy"])
        reader = PdfReader(str(pdf))
        if reader.is_encrypted:
            reader.decrypt("")
        xml = extract_datasets_xml(reader) or ""
        hits = [n for n in NEEDLES if n in xml]
        # Form-specific minimum
        required = ["ADOBECHECK"]
        if code == "IMM5562":
            required.append("Singapore")
        if code in {"IMM0008", "IMM1294", "IMM1295"}:
            required.extend(["English", "Sinhala"] if "Sinhala" in xml or "English" in xml else ["ADOBECHECK"])
        missing = [r for r in required if r not in xml]
        status = "OK" if not missing else "WEAK"
        if missing:
            rc = 1
        print(f"{code}: {status} bytes={pdf.stat().st_size} hits={hits} missing={missing}")
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
