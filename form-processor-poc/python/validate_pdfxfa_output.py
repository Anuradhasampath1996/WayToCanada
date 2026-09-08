#!/usr/bin/env python3
"""Structural regression validator for pdfXFA append-mode outputs."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from pypdf import PdfReader
from pypdf.generic import ArrayObject, IndirectObject, StreamObject

# Official IMM 5476 template (11-2025) — update when Canada.ca publishes new version
OFFICIAL_IMM5476_SHA256 = "aca5c476b93d1c496b1afbc2cfe843499e852e31dcf0c192153bd01f8d6c56c4"
IMM5476_SYNTHETIC_VALUES = [
    "POCTEST",
    "Synthetic Client",
    "Synthetic RCIC",
    "Consultant",
    "R999999999",
    "RCICMASTER PoC Firm",
    "poc.test@example.invalid",
]
IMM5476_REQUIRED_PACKETS = {"datasets", "template", "config"}


def stream_bytes(obj, reader):
    if isinstance(obj, IndirectObject):
        obj = obj.get_object()
    if isinstance(obj, StreamObject):
        return obj.get_data()
    return None


def extract_xfa_packet_names(reader: PdfReader) -> set[str]:
    root = reader.trailer["/Root"]
    if isinstance(root, IndirectObject):
        root = root.get_object()
    acro = root.get("/AcroForm")
    if acro is None:
        return set()
    if isinstance(acro, IndirectObject):
        acro = acro.get_object()
    xfa = acro.get("/XFA")
    if xfa is None:
        return set()
    if isinstance(xfa, IndirectObject):
        xfa = xfa.get_object()
    names: set[str] = set()
    if isinstance(xfa, ArrayObject):
        for i in range(0, len(xfa) - 1, 2):
            names.add(str(xfa[i]).lstrip("/"))
    return names


def extract_datasets_xml(reader: PdfReader) -> str | None:
    root = reader.trailer["/Root"]
    if isinstance(root, IndirectObject):
        root = root.get_object()
    acro = root.get("/AcroForm")
    if isinstance(acro, IndirectObject):
        acro = acro.get_object()
    xfa = acro.get("/XFA")
    if not isinstance(xfa, (ArrayObject, IndirectObject)):
        return None
    if isinstance(xfa, IndirectObject):
        xfa = xfa.get_object()
    if isinstance(xfa, ArrayObject):
        for i in range(0, len(xfa) - 1, 2):
            if str(xfa[i]).lstrip("/") == "datasets":
                data = stream_bytes(xfa[i + 1], reader)
                return data.decode("utf-8", errors="replace") if data else None
    return None


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def validate_imm5476_pdfxfa_append(original: Path, output: Path) -> dict:
    errors: list[str] = []
    checks: dict[str, bool | int | str] = {}

    if sha256_file(original) != OFFICIAL_IMM5476_SHA256:
        errors.append(f"Unexpected official template SHA-256 (got {sha256_file(original)})")

    orig_reader = PdfReader(str(original))
    out_reader = PdfReader(str(output))
    if orig_reader.is_encrypted:
        orig_reader.decrypt("")
    if out_reader.is_encrypted:
        out_reader.decrypt("")

    checks["source_pages"] = len(orig_reader.pages)
    checks["output_pages"] = len(out_reader.pages)
    if checks["output_pages"] != 4:
        errors.append(f"Expected 4 pages, got {checks['output_pages']}")
    if checks["source_pages"] != checks["output_pages"]:
        errors.append("Page count changed")

    orig_packets = extract_xfa_packet_names(orig_reader)
    out_packets = extract_xfa_packet_names(out_reader)
    checks["xfa_packets_present"] = sorted(out_packets)
    if not out_packets:
        errors.append("No XFA packets in output")
    missing_packets = IMM5476_REQUIRED_PACKETS - out_packets
    if missing_packets:
        errors.append(f"Missing required XFA packets: {sorted(missing_packets)}")

    orig_datasets = extract_datasets_xml(orig_reader) or ""
    out_datasets = extract_datasets_xml(out_reader) or ""
    checks["datasets_changed"] = orig_datasets != out_datasets
    if not checks["datasets_changed"]:
        errors.append("XFA datasets packet unchanged")

    value_checks = {v: (v in out_datasets) for v in IMM5476_SYNTHETIC_VALUES}
    checks["synthetic_values_in_datasets"] = value_checks
    for value, present in value_checks.items():
        if not present:
            errors.append(f"Missing synthetic value in datasets: {value}")

    checks["output_encrypted"] = out_reader.is_encrypted
    if not checks["output_encrypted"]:
        errors.append("Output encryption not preserved")

    checks["output_sha256"] = sha256_file(output)
    checks["passed"] = len(errors) == 0
    checks["errors"] = errors
    return checks


def main() -> int:
    if len(sys.argv) < 4:
        print("Usage: validate_pdfxfa_output.py imm5476 <original.pdf> <output.pdf>", file=sys.stderr)
        return 1

    form = sys.argv[1].lower()
    original = Path(sys.argv[2]).resolve()
    output = Path(sys.argv[3]).resolve()

    if not original.exists():
        print(json.dumps({"passed": False, "errors": [f"Original not found: {original}"]}))
        return 1
    if not output.exists():
        print(json.dumps({"passed": False, "errors": [f"Output not found: {output}"]}))
        return 1

    if form == "imm5476":
        result = validate_imm5476_pdfxfa_append(original, output)
    else:
        print(json.dumps({"passed": False, "errors": [f"Unknown form: {form}"]}))
        return 1

    print(json.dumps(result, indent=2))
    return 0 if result.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
