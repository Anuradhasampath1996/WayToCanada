#!/usr/bin/env python3
"""Extract XFA packet XML from a PDF (read-only)."""

from __future__ import annotations

import sys
from pathlib import Path

from pypdf import PdfReader
from pypdf.generic import ArrayObject, IndirectObject, StreamObject


def stream_bytes(obj, reader):
    if isinstance(obj, IndirectObject):
        obj = obj.get_object()
    if isinstance(obj, StreamObject):
        return obj.get_data()
    return None


def extract_packets(pdf_path: Path) -> dict[str, bytes]:
    reader = PdfReader(str(pdf_path))
    if reader.is_encrypted:
        reader.decrypt("")
    root = reader.trailer["/Root"]
    if isinstance(root, IndirectObject):
        root = root.get_object()
    acro = root.get("/AcroForm")
    if isinstance(acro, IndirectObject):
        acro = acro.get_object()
    xfa = acro.get("/XFA") if acro else None
    if xfa is None:
        return {}
    if isinstance(xfa, IndirectObject):
        xfa = xfa.get_object()
    packets: dict[str, bytes] = {}
    if isinstance(xfa, ArrayObject):
        for i in range(0, len(xfa) - 1, 2):
            name = str(xfa[i]).lstrip("/")
            data = stream_bytes(xfa[i + 1], reader)
            if data:
                packets[name] = data
    else:
        data = stream_bytes(xfa, reader)
        if data:
            packets["combined"] = data
    return packets


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: extract_xfa_packets.py <input.pdf> <output_dir>", file=sys.stderr)
        return 1
    pdf_path = Path(sys.argv[1]).resolve()
    out_dir = Path(sys.argv[2]).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    packets = extract_packets(pdf_path)
    for name, data in packets.items():
        ext = ".xml" if name in {"datasets", "template", "config", "localeSet", "xmpmeta"} else ".bin"
        out_file = out_dir / f"{name}{ext}"
        out_file.write_bytes(data)
        print(f"Wrote {out_file} ({len(data)} bytes)", file=sys.stderr)
    print(f"Extracted {len(packets)} XFA packets: {sorted(packets.keys())}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
