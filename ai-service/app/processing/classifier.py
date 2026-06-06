"""
classifier.py — Determine identity document type from extracted text.

Priority order:
  1. MRZ line pattern  →  passport (strongest signal)
  2. Keyword frequency →  driving_license > national_id > passport > unknown
"""

from __future__ import annotations

import re

# ── Keyword lists ─────────────────────────────────────────────────────────────

_PASSPORT_KW: list[str] = [
    "PASSPORT", "PASSEPORT", "SURNAME", "GIVEN NAME", "GIVEN NAMES",
    "NATIONALITY", "PLACE OF BIRTH", "DATE OF ISSUE", "REPUBLIC OF",
]

_NATIONAL_ID_KW: list[str] = [
    "NATIONAL ID", "NATIONAL IDENTITY", "IDENTITY CARD", "ID CARD",
    "CNIC", "NIC", "NADRA", "CITIZEN", "NIDA", "EMIRATES ID",
    "RESIDENT ID", "AADHAR", "AADHAAR", "PAN CARD",
]

_DRIVING_LICENSE_KW: list[str] = [
    "DRIVING", "LICENCE", "LICENSE", "DRIVER", "MOTOR VEHICLE",
    "CLASS", "DLNO", "DL NO", "DRIVING LICENCE", "DRIVING LICENSE",
    "VEHICLE CATEGORY",
]

# MRZ line 1 starts with P< for passports (ICAO TD3 standard)
_MRZ_PASSPORT_RE = re.compile(r"^P[A-Z<][A-Z]{3}[A-Z<]+$", re.MULTILINE)


# ── Public API ────────────────────────────────────────────────────────────────

def classify_document(text: str) -> str:
    """
    Classify extracted document text into one of four categories:
      'passport' | 'national_id' | 'driving_license' | 'unknown'
    """
    # 1. Strongest signal: MRZ line
    if _MRZ_PASSPORT_RE.search(text):
        return "passport"

    upper = text.upper()

    scores: dict[str, int] = {
        "passport":         _score(upper, _PASSPORT_KW),
        "national_id":      _score(upper, _NATIONAL_ID_KW),
        "driving_license":  _score(upper, _DRIVING_LICENSE_KW),
    }

    best, best_score = max(scores.items(), key=lambda kv: kv[1])
    return best if best_score > 0 else "unknown"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _score(upper_text: str, keywords: list[str]) -> int:
    return sum(1 for kw in keywords if kw in upper_text)
