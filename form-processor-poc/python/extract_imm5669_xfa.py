#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

from pypdf import PdfReader


def main() -> None:
    path = Path(
        "backend/storage/app/private/government-forms-poc/templates/official/"
        "imm5669-official-4bdc23bb6a9d.pdf"
    )
    reader = PdfReader(str(path))
    if reader.is_encrypted:
        reader.decrypt("")

    acro = reader.trailer["/Root"]["/AcroForm"]
    xfa = acro["/XFA"]
    if hasattr(xfa, "get_object"):
        xfa = xfa.get_object()

    out = Path("backend/storage/app/private/government-forms-poc/reports/xfa-imm5669")
    out.mkdir(parents=True, exist_ok=True)

    for i in range(0, len(xfa), 2):
        name = str(xfa[i])
        stream = xfa[i + 1]
        data = stream.get_data() if hasattr(stream, "get_data") else stream.get_object().get_data()
        safe = re.sub(r"[^a-zA-Z0-9_-]+", "_", name)
        (out / f"{safe}.xml").write_bytes(data)
        print(f"{name}: {len(data)} bytes -> {safe}.xml")

        if name.lower() in {"template", "datasets", "form"} or b'name="' in data:
            text = data.decode("utf-8", errors="replace")
            for m in re.finditer(r'name="([^"]+)"', text):
                n = m.group(1)
                if any(k in n.lower() for k in ("uci", "client", "birth", "family", "given", "foss")):
                    # print nearby bind/ref if any
                    start = max(0, m.start() - 120)
                    end = min(len(text), m.end() + 200)
                    snippet = text[start:end].replace("\n", " ")
                    print(f"  name={n}")
                    print(f"    ctx={snippet[:260]}")


if __name__ == "__main__":
    main()
