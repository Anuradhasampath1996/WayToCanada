#!/usr/bin/env python3
"""Stage G structural validation for UI-downloaded IMM 5476."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "form-processor-poc" / "python"))

from validate_pdfxfa_output import (  # noqa: E402
    OFFICIAL_IMM5476_SHA256,
    extract_datasets_xml,
    extract_xfa_packet_names,
    sha256_file,
    validate_imm5476_pdfxfa_append,
)
from pypdf import PdfReader

STAGE_G_VALUES = [
    "STAGEGTEST",
    "SYNTHETIC",
    "SYNTHETIC RCIC",
    "CONSULTANT",
    "R999999999",
    "RCICMASTER Stage G",
]


def validate_stage_g(original: Path, output: Path) -> dict:
    base = validate_imm5476_pdfxfa_append(original, output)
    errors = list(base.get("errors") or [])

    reader = PdfReader(str(output))
    if reader.is_encrypted:
        reader.decrypt("")
    datasets = extract_datasets_xml(reader) or ""
    packets = extract_xfa_packet_names(reader)

    value_checks = {v: (v in datasets) for v in STAGE_G_VALUES}
    base["stage_g_synthetic_values_in_datasets"] = value_checks
    for value, present in value_checks.items():
        if not present:
            errors.append(f"Missing Stage G synthetic value in datasets: {value}")

    # Ignore PoC-only synthetic value failures from base validator.
    errors = [e for e in errors if not e.startswith("Missing synthetic value in datasets:")]

    base["errors"] = errors
    base["passed"] = len(errors) == 0
    base["template_sha256"] = OFFICIAL_IMM5476_SHA256
    base["xfa_packets"] = sorted(packets)
    base["output_sha256"] = sha256_file(output)
    return base


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: validate-stage-g-pdf.py <original.pdf> <downloaded.pdf>", file=sys.stderr)
        return 1

    original = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    result = validate_stage_g(original, output)
    print(json.dumps(result, indent=2))
    return 0 if result.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
