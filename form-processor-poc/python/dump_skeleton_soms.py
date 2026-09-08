#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from xml.etree import ElementTree as ET
import re

WANT = {
    "FamilyName",
    "GivenName",
    "GivenNames",
    "DOBYear",
    "DOBMonth",
    "DOBDay",
    "DOB",
    "COB",
    "UCIClientID",
    "PlaceBirthCity",
    "PlaceBirthCountry",
    "Email",
    "PassportNum",
    "CountryofIssue",
    "nativeLang",
    "ableToCommunicate",
    "ActualNumber",
}


def paths(xml_path: Path) -> None:
    raw = Path(xml_path).read_text(encoding="utf-8")
    raw = raw.replace('xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"', "")
    raw = re.sub(r'\s*xfa:dataNode="[^"]*"', "", raw)
    root = ET.fromstring(raw)
    found: list[str] = []

    def walk(el: ET.Element, stack: list[str]) -> None:
        name = el.tag.split("}")[-1]
        stack = stack + [name]
        if name in WANT:
            som = ".".join(f"{p}[0]" for p in stack)
            found.append(som)
        for child in list(el):
            walk(child, stack)

    walk(root, [])
    print(f"=== {xml_path.name} ===")
    for s in found:
        print(s)


if __name__ == "__main__":
    fx = Path(__file__).resolve().parents[1] / "fixtures"
    for name in (
        "imm1294_datasets_skeleton.xml",
        "imm1295_datasets_skeleton.xml",
        "imm5707_datasets_skeleton.xml",
    ):
        paths(fx / name)
