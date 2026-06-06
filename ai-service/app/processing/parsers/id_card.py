"""
id_card.py — Parser for National ID cards and Driving Licences.

Covers common document formats:
  - Pakistan CNIC  (XXXXX-XXXXXXX-X)
  - Generic numeric / alphanumeric ID numbers
  - Driving licence numbers (DL + alphanumeric)
"""

from __future__ import annotations

import re

from app.models import ExtractedData
from .base import BaseParser


class IDCardParser(BaseParser):
    """Extract structured data from National ID / Driving Licence OCR text."""

    # ── ID number patterns ────────────────────────────────────────────────────

    # Pakistan CNIC: 42000-1234567-1
    _CNIC = re.compile(r"\b(\d{5}[\s\-\/]\d{7}[\s\-\/]\d)\b")

    # UAE Emirates ID: 784-YYYY-XXXXXXX-D
    _EMIRATES_ID = re.compile(r"\b(784[\-\s]\d{4}[\-\s]\d{7}[\-\s]\d)\b")

    # India Aadhaar: 4+4+4 digits
    _AADHAAR = re.compile(r"\b(\d{4}\s\d{4}\s\d{4})\b")

    # Sri Lanka NIC (new 12-digit) — may be preceded by "No.:" label
    _SL_NIC = re.compile(r"\b(\d{12})\b")

    # Sri Lanka NIC (old 9-digit + letter V/X)
    _SL_NIC_OLD = re.compile(r"\b(\d{9}[VXvx])\b")

    # Generic driving licence number: letters + digits (6–20 chars)
    _DL_NUM = re.compile(r"\b(DL[\s\-]?[A-Z0-9]{6,15})\b", re.I)

    # Fallback generic ID: 6–20 alphanumeric
    _GENERIC_ID = re.compile(r"\b([A-Z]{0,3}\d{7,20})\b")

    # ── Name patterns ─────────────────────────────────────────────────────────

    _NAME = re.compile(
        r"(?:FULL\s+NAME|NAME|HOLDER|DRIVER|LICENCE\s+HOLDER|CARDHOLDER)\s*[:\-]?\s*"
        r"([A-Z][A-Z\s\-\.]{2,60})",
        re.I,
    )

    # ── Date patterns ─────────────────────────────────────────────────────────

    _DOB_LABEL = re.compile(
        r"(?:DATE\s+OF\s+BIRTH|DOB|BORN|D\.O\.B|BIRTH\s+DATE)\s*[:\-]?\s*"
        r"(\d[\d\/\-\.\s]{4,}\d)",
        re.I,
    )
    _EXPIRY_LABEL = re.compile(
        r"(?:DATE\s+OF\s+EXPIRY|EXPIRY|EXPIRATION|VALID\s+UNTIL|VALID\s+TO|EXP|VALID\s+THRU)\s*[:\-]?\s*"
        r"(\d[\d\/\-\.\s]{4,}\d)",
        re.I,
    )

    # Back-side: Date of Issue / Issue Date
    _ISSUE_LABEL = re.compile(
        r"(?:DATE\s+OF\s+ISSUE|ISSUE\s+DATE|ISSUED\s+ON|DATE\s+ISSUED)\s*[:\-]?\s*"
        r"(\d[\d\/\-\.\s]{4,}\d)",
        re.I,
    )

    # Back-side: Birth Place
    _BIRTH_PLACE = re.compile(
        r"(?:BIRTH\s+PLACE|PLACE\s+OF\s+BIRTH|BIRTHPLACE)\s*[:\-]?\s*"
        r"([A-Z][A-Z\s\-\.]{1,50})",
        re.I,
    )

    _GENDER = re.compile(r"\b(MALE|FEMALE|M|F)\b", re.I)

    # Address label followed by address text (multi-word, may span a line)
    _ADDRESS = re.compile(
        r"(?:PERMANENT\s+ADDRESS|RESIDENTIAL\s+ADDRESS|ADDRESS|ADDR)\s*[:\-]?\s*"
        r"([^\n]{5,120})",
        re.I,
    )

    # ── Public ────────────────────────────────────────────────────────────────

    def parse(self, text: str) -> ExtractedData:
        data = ExtractedData()

        # ── Name ──────────────────────────────────────────────────────────────
        m = self._NAME.search(text)
        if m:
            data.fullName = self.clean_name(m.group(1))

        # ── ID number (prioritised by document type specificity) ──────────────
        for pattern, transform in [
            (self._CNIC,         lambda g: re.sub(r"\s", "-", g)),
            (self._EMIRATES_ID,  lambda g: re.sub(r"\s", "-", g)),
            (self._AADHAAR,      lambda g: g),
            (self._SL_NIC,       lambda g: g),
            (self._SL_NIC_OLD,   lambda g: g.upper()),
            (self._DL_NUM,       lambda g: g.upper()),
            (self._GENERIC_ID,   lambda g: g.upper()),
        ]:
            m = pattern.search(text)
            if m:
                data.idNumber = transform(m.group(1))
                break

        # ── Date of birth ─────────────────────────────────────────────────────
        m = self._DOB_LABEL.search(text)
        if m:
            data.dob = self.normalize_date(m.group(1).strip())
        else:
            # Fallback: pick first plausible date in the text
            dates = self._DATE_PAT.findall(text)
            if dates:
                data.dob = self.normalize_date(dates[0])

        # ── Expiry ────────────────────────────────────────────────────────────
        m = self._EXPIRY_LABEL.search(text)
        if m:
            data.expiryDate = self.normalize_date(m.group(1).strip())
        else:
            dates = self._DATE_PAT.findall(text)
            if len(dates) >= 2:
                data.expiryDate = self.normalize_date(dates[1])

        # ── Gender ────────────────────────────────────────────────────────────
        m = self._GENDER.search(text)
        if m:
            raw_g = m.group(1).upper()
            data.gender = "Male" if raw_g in ("M", "MALE") else "Female"

        # ── Address (back side) ───────────────────────────────────────────────
        m = self._ADDRESS.search(text)
        if m:
            data.address = m.group(1).strip()

        # ── Date of Issue (back side) ─────────────────────────────────────────
        m = self._ISSUE_LABEL.search(text)
        if m:
            data.issueDate = self.normalize_date(m.group(1).strip())

        # ── Birth Place (back side) ───────────────────────────────────────────
        m = self._BIRTH_PLACE.search(text)
        if m:
            data.birthPlace = m.group(1).strip().title()

        return data
