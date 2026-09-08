#!/usr/bin/env python3
"""Deep structural comparison of official vs generated IRCC PDFs (read-only)."""

from __future__ import annotations

import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from pypdf import PdfReader
from pypdf.generic import (
    ArrayObject,
    DictionaryObject,
    IndirectObject,
    NameObject,
    StreamObject,
    TextStringObject,
)


TEST_FIELDS = [
    "IMM_5476[0].Page1[0].SectionA[0].familyName[0]",
    "IMM_5476[0].Page1[0].SectionA[0].givenName[0]",
    "IMM_5476[0].Page1[0].SectionB[0].familyName[0]",
    "IMM_5476[0].Page1[0].SectionB[0].givenName[0]",
    "IMM_5476[0].Page1[0].SectionB[0].question6[0].questionII[0].ICCRCMember[0]",
    "IMM_5476[0].Page1[0].SectionB[0].question7[0].organization[0]",
    "IMM_5476[0].Page1[0].SectionB[0].question7[0].email[0]",
]

SYNTHETIC_VALUES = {
    "IMM_5476[0].Page1[0].SectionA[0].familyName[0]": "POCTEST",
    "IMM_5476[0].Page1[0].SectionA[0].givenName[0]": "Synthetic Client",
    "IMM_5476[0].Page1[0].SectionB[0].familyName[0]": "Synthetic RCIC",
    "IMM_5476[0].Page1[0].SectionB[0].givenName[0]": "Consultant",
    "IMM_5476[0].Page1[0].SectionB[0].question6[0].questionII[0].ICCRCMember[0]": "R999999999",
    "IMM_5476[0].Page1[0].SectionB[0].question7[0].organization[0]": "RCICMASTER PoC Firm",
    "IMM_5476[0].Page1[0].SectionB[0].question7[0].email[0]": "poc.test@example.invalid",
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def resolve(obj: Any, reader: PdfReader, depth: int = 0) -> Any:
    if depth > 20:
        return obj
    if isinstance(obj, IndirectObject):
        return resolve(obj.get_object(), reader, depth + 1)
    if isinstance(obj, DictionaryObject):
        return {str(k): resolve(v, reader, depth + 1) for k, v in obj.items()}
    if isinstance(obj, ArrayObject):
        return [resolve(v, reader, depth + 1) for v in obj]
    if isinstance(obj, NameObject):
        return str(obj)
    if isinstance(obj, TextStringObject):
        return str(obj)
    if isinstance(obj, bytes):
        return f"<bytes len={len(obj)}>"
    if isinstance(obj, StreamObject):
        data = obj.get_data()
        return {
            "_stream": True,
            "length": len(data),
            "filter": resolve(obj.get("/Filter"), reader, depth + 1),
            "preview": data[:200].decode("latin-1", errors="replace"),
        }
    return obj


def stream_bytes(obj: Any, reader: PdfReader) -> bytes | None:
    if isinstance(obj, IndirectObject):
        obj = obj.get_object()
    if isinstance(obj, StreamObject):
        return obj.get_data()
    return None


def extract_xfa_packets(reader: PdfReader) -> dict[str, Any]:
    root = reader.trailer["/Root"]
    if isinstance(root, IndirectObject):
        root = root.get_object()
    acro = root.get("/AcroForm")
    if acro is None:
        return {"present": False, "packets": {}}
    if isinstance(acro, IndirectObject):
        acro = acro.get_object()

    xfa = acro.get("/XFA")
    if xfa is None:
        return {"present": False, "packets": {}}

    packets: dict[str, Any] = {}
    if isinstance(xfa, IndirectObject):
        xfa = xfa.get_object()

    if isinstance(xfa, ArrayObject):
        i = 0
        while i < len(xfa) - 1:
            name = str(xfa[i]).lstrip("/")
            stream_obj = xfa[i + 1]
            data = stream_bytes(stream_obj, reader)
            packets[name] = {
                "byte_length": len(data) if data else 0,
                "sha256": hashlib.sha256(data).hexdigest() if data else None,
                "preview": (data[:500].decode("utf-8", errors="replace") if data else None),
            }
            i += 2
    elif isinstance(xfa, (StreamObject, IndirectObject)):
        data = stream_bytes(xfa, reader)
        packets["combined"] = {
            "byte_length": len(data) if data else 0,
            "sha256": hashlib.sha256(data).hexdigest() if data else None,
            "preview": (data[:500].decode("utf-8", errors="replace") if data else None),
        }

    return {"present": True, "packets": packets}


def extract_datasets_xml(reader: PdfReader) -> str | None:
    packets = extract_xfa_packets(reader)
    if not packets["present"]:
        return None
    datasets = packets["packets"].get("datasets")
    if not datasets:
        return None
    root = reader.trailer["/Root"]
    if isinstance(root, IndirectObject):
        root = root.get_object()
    acro = root.get("/AcroForm")
    if isinstance(acro, IndirectObject):
        acro = acro.get_object()
    xfa = acro.get("/XFA")
    if isinstance(xfa, IndirectObject):
        xfa = xfa.get_object()
    if isinstance(xfa, ArrayObject):
        for i in range(0, len(xfa) - 1, 2):
            if str(xfa[i]).lstrip("/") == "datasets":
                data = stream_bytes(xfa[i + 1], reader)
                return data.decode("utf-8", errors="replace") if data else None
    return None


def search_values_in_xml(xml_text: str | None) -> dict[str, bool]:
    if not xml_text:
        return {v: False for v in SYNTHETIC_VALUES.values()}
    return {v: (v in xml_text) for v in SYNTHETIC_VALUES.values()}


def flatten_fields(fields: Any, reader: PdfReader, prefix: str = "") -> dict[str, dict]:
    result: dict[str, dict] = {}
    if fields is None:
        return result
    if isinstance(fields, IndirectObject):
        fields = fields.get_object()
    if not isinstance(fields, ArrayObject):
        return result

    for ref in fields:
        field = ref.get_object() if isinstance(ref, IndirectObject) else ref
        if not isinstance(field, DictionaryObject):
            continue
        partial = field.get("/T")
        name = str(partial) if partial else prefix
        full_name = f"{prefix}.{name}" if prefix and partial else (str(partial) if partial else prefix)
        if partial:
            kids = field.get("/Kids")
            if kids:
                result.update(flatten_fields(kids, reader, full_name))
            else:
                result[full_name] = field_summary(field, reader)
        else:
            kids = field.get("/Kids")
            if kids:
                result.update(flatten_fields(kids, reader, prefix))
    return result


def field_summary(field: DictionaryObject, reader: PdfReader) -> dict[str, Any]:
    ft = field.get("/FT")
    v = field.get("/V")
    dv = field.get("/DV")
    da = field.get("/DA")
    kids = field.get("/Kids")
    ap = field.get("/AP")
    aa = field.get("/AA")
    a = field.get("/A")

    widgets = []
    if kids:
        kid_list = kids if isinstance(kids, ArrayObject) else ArrayObject([kids])
        for kid_ref in kid_list:
            kid = kid_ref.get_object() if isinstance(kid_ref, IndirectObject) else kid_ref
            if isinstance(kid, DictionaryObject):
                widgets.append(widget_summary(kid))

    return {
        "FT": str(ft) if ft else None,
        "V": str(v) if v is not None else None,
        "DV": str(dv) if dv is not None else None,
        "DA": str(da) if da else None,
        "has_AP": ap is not None,
        "AP_keys": list(ap.keys()) if isinstance(ap, DictionaryObject) else None,
        "has_AA": aa is not None,
        "has_A": a is not None,
        "widget_count": len(widgets),
        "widgets": widgets,
    }


def widget_summary(widget: DictionaryObject) -> dict[str, Any]:
    ap = widget.get("/AP")
    as_state = widget.get("/AS")
    subtype = widget.get("/Subtype")
    ap_info: dict[str, Any] = {"present": ap is not None}
    if isinstance(ap, DictionaryObject):
        ap_info["keys"] = [str(k) for k in ap.keys()]
        n = ap.get("/N")
        if isinstance(n, StreamObject):
            ap_info["N_stream_length"] = len(n.get_data())
        elif isinstance(n, DictionaryObject):
            ap_info["N_states"] = [str(k) for k in n.keys()]
    return {
        "Subtype": str(subtype) if subtype else None,
        "AS": str(as_state) if as_state else None,
        "AP": ap_info,
    }


def collect_js(reader: PdfReader) -> list[str]:
    found: list[str] = []
    root = reader.trailer["/Root"]
    if isinstance(root, IndirectObject):
        root = root.get_object()

    names = root.get("/Names")
    if names:
        if isinstance(names, IndirectObject):
            names = names.get_object()
        js_tree = names.get("/JavaScript")
        if js_tree:
            if isinstance(js_tree, IndirectObject):
                js_tree = js_tree.get_object()
            names_arr = js_tree.get("/Names")
            if isinstance(names_arr, ArrayObject):
                for i in range(0, len(names_arr) - 1, 2):
                    label = str(names_arr[i])
                    obj = names_arr[i + 1]
                    if isinstance(obj, IndirectObject):
                        obj = obj.get_object()
                    if isinstance(obj, DictionaryObject):
                        js = obj.get("/JS")
                        if js:
                            if isinstance(js, IndirectObject):
                                js = js.get_object()
                            if isinstance(js, StreamObject):
                                found.append(f"{label}: {js.get_data()[:300].decode('latin-1', errors='replace')}")
                            else:
                                found.append(f"{label}: {str(js)[:300]}")
    return found


def inspect_perms(reader: PdfReader) -> dict[str, Any]:
    root = reader.trailer["/Root"]
    if isinstance(root, IndirectObject):
        root = root.get_object()
    perms = root.get("/Perms")
    if perms is None:
        return {"present": False}
    if isinstance(perms, IndirectObject):
        perms = perms.get_object()
    result: dict[str, Any] = {"present": True, "keys": [str(k) for k in perms.keys()]}
    for key in ["/DocMDP", "/UR", "/UR3"]:
        val = perms.get(key)
        if val is not None:
            if isinstance(val, IndirectObject):
                val = val.get_object()
            if isinstance(val, DictionaryObject):
                result[str(key)] = {str(k): str(v) for k, v in val.items()}
            else:
                result[str(key)] = str(val)
    return result


def inspect_signatures(reader: PdfReader) -> list[dict]:
    sigs = []
    if reader.get_fields():
        for name, field in reader.get_fields().items():
            ft = field.get("/FT") if hasattr(field, "get") else None
            if str(ft) == "/Sig" or "/Sig" in str(field):
                sigs.append({"name": name, "raw": str(field)[:500]})
    # Also scan AcroForm /SigFlags
    root = reader.trailer["/Root"]
    if isinstance(root, IndirectObject):
        root = root.get_object()
    acro = root.get("/AcroForm")
    if acro:
        if isinstance(acro, IndirectObject):
            acro = acro.get_object()
        sigflags = acro.get("/SigFlags")
        if sigflags is not None:
            sigs.append({"acroform_sigflags": int(sigflags)})
    return sigs


def inspect_acroform(reader: PdfReader) -> dict[str, Any]:
    root = reader.trailer["/Root"]
    if isinstance(root, IndirectObject):
        root = root.get_object()
    acro = root.get("/AcroForm")
    if acro is None:
        return {"present": False}
    if isinstance(acro, IndirectObject):
        acro = acro.get_object()

    fields = reader.get_fields() or {}
    flat = {}
    for name, field in fields.items():
        if field is None:
            continue
        v = field.get("/V") if hasattr(field, "get") else None
        dv = field.get("/DV") if hasattr(field, "get") else None
        flat[name] = {
            "V": str(v) if v is not None else None,
            "DV": str(dv) if dv is not None else None,
            "FT": str(field.get("/FT")) if hasattr(field, "get") and field.get("/FT") else None,
        }

    return {
        "present": True,
        "NeedAppearances": str(acro.get("/NeedAppearances")) if acro.get("/NeedAppearances") is not None else None,
        "SigFlags": int(acro.get("/SigFlags")) if acro.get("/SigFlags") is not None else None,
        "has_XFA": acro.get("/XFA") is not None,
        "has_DR": acro.get("/DR") is not None,
        "has_DA": acro.get("/DA") is not None,
        "field_count": len(flat),
        "test_fields": {k: flat.get(k) for k in TEST_FIELDS},
    }


def inspect_encryption(reader: PdfReader) -> dict[str, Any]:
    if reader.is_encrypted:
        return {
            "encrypted": True,
            "decrypted_with_empty_password": True,
        }
    return {"encrypted": False}


def inspect_catalog(reader: PdfReader) -> dict[str, Any]:
    root = reader.trailer["/Root"]
    if isinstance(root, IndirectObject):
        root = root.get_object()
    info = reader.metadata or {}
    return {
        "Type": str(root.get("/Type")) if root.get("/Type") else None,
        "Version": str(root.get("/Version")) if root.get("/Version") else None,
        "PageCount": len(reader.pages),
        "Metadata": {k: str(v) for k, v in info.items()} if info else {},
        "OpenAction": str(root.get("/OpenAction")) if root.get("/OpenAction") else None,
        "AA_present": root.get("/AA") is not None,
    }


def analyze_pdf(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    if reader.is_encrypted:
        reader.decrypt("")

    datasets_xml = extract_datasets_xml(reader)
    return {
        "file": str(path),
        "sha256": sha256_file(path),
        "byte_size": path.stat().st_size,
        "catalog": inspect_catalog(reader),
        "encryption": inspect_encryption(reader),
        "acroform": inspect_acroform(reader),
        "xfa_packets": extract_xfa_packets(reader),
        "xfa_datasets_values_present": search_values_in_xml(datasets_xml),
        "xfa_datasets_xml_length": len(datasets_xml) if datasets_xml else 0,
        "xfa_datasets_xml_excerpt": (datasets_xml[:2000] if datasets_xml else None),
        "document_javascript": collect_js(reader),
        "perms": inspect_perms(reader),
        "signatures": inspect_signatures(reader),
    }


def compare_pdfs(original: Path, generated: Path) -> dict[str, Any]:
    orig = analyze_pdf(original)
    gen = analyze_pdf(generated)

    field_diffs = {}
    for field in TEST_FIELDS:
        o = orig["acroform"]["test_fields"].get(field, {})
        g = gen["acroform"]["test_fields"].get(field, {})
        field_diffs[field] = {
            "original_V": o.get("V") if o else None,
            "generated_V": g.get("V") if g else None,
            "expected_value": SYNTHETIC_VALUES.get(field),
            "acroform_value_written": g.get("V") == SYNTHETIC_VALUES.get(field) if g else False,
        }

    xfa_packet_diff = {}
    op = orig["xfa_packets"].get("packets", {})
    gp = gen["xfa_packets"].get("packets", {})
    all_names = sorted(set(op.keys()) | set(gp.keys()))
    for name in all_names:
        o_pkt = op.get(name, {})
        g_pkt = gp.get(name, {})
        xfa_packet_diff[name] = {
            "original_sha256": o_pkt.get("sha256"),
            "generated_sha256": g_pkt.get("sha256"),
            "unchanged": o_pkt.get("sha256") == g_pkt.get("sha256"),
            "original_length": o_pkt.get("byte_length"),
            "generated_length": g_pkt.get("byte_length"),
        }

    datasets_value_diff = {
        "original": orig["xfa_datasets_values_present"],
        "generated": gen["xfa_datasets_values_present"],
    }

    return {
        "original": orig,
        "generated": gen,
        "test_field_acroform_diff": field_diffs,
        "xfa_packet_diff": xfa_packet_diff,
        "xfa_datasets_synthetic_values": datasets_value_diff,
        "structural_summary": {
            "xfa_present_original": orig["xfa_packets"]["present"],
            "xfa_present_generated": gen["xfa_packets"]["present"],
            "datasets_unchanged": xfa_packet_diff.get("datasets", {}).get("unchanged"),
            "encryption_removed": orig["encryption"]["encrypted"] and not gen["encryption"]["encrypted"],
            "producer_changed": orig["catalog"]["Metadata"].get("/Producer") != gen["catalog"]["Metadata"].get("/Producer"),
            "perms_original": orig["perms"],
            "perms_generated": gen["perms"],
            "document_js_original_count": len(orig["document_javascript"]),
            "document_js_generated_count": len(gen["document_javascript"]),
        },
    }


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: deep_pdf_diff.py <original.pdf> <generated.pdf> [output.json]", file=sys.stderr)
        return 1

    original = Path(sys.argv[1]).resolve()
    generated = Path(sys.argv[2]).resolve()
    report = compare_pdfs(original, generated)

    if len(sys.argv) >= 4:
        out_path = Path(sys.argv[3]).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            json.dumps(report, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"Report written: {out_path}", file=sys.stderr)
    else:
        sys.stdout.buffer.write(json.dumps(report, indent=2, ensure_ascii=False).encode("utf-8"))
        sys.stdout.buffer.write(b"\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
