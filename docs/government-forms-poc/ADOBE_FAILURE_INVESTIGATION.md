# IMM 5476 Adobe Failure — Root Cause Investigation Report

Date: 2026-09-01  
Status: **Phase B BLOCKED** — Adobe acceptance not achieved by any tested method yet.

## Executive summary

Manual Adobe Acrobat Reader testing of `IMM5476_itext_test.pdf` **failed all interactive criteria**. Programmatic inspection confirms why:

**IMM 5476 (11-2025) is an Adobe Designer XFA-hybrid form (`formModel both`, `scriptModel XFA`), not a plain AcroForm.** Adobe Acrobat renders and interacts through the **XFA data model and XFA scripts**, not AcroForm `/V` alone.

The failed iText Core PoC wrote values only to **AcroForm field dictionaries** while leaving the **XFA `datasets` packet byte-identical**. Adobe therefore showed blank fields and broken Save/Reset/Print behaviour.

A follow-up test using **iText pdfXFA `fillXfaForm()` in append mode** successfully updated the XFA datasets packet and preserved encryption. This candidate **requires Adobe manual re-test** before any production decision.

---

## 1. Root cause of Adobe failure (proven)

| Layer | Original | Failed iText Core output |
|-------|----------|--------------------------|
| AcroForm `/V` for 7 test fields | empty | **populated** (POCTEST, etc.) |
| XFA `datasets` packet SHA-256 | `e7b604b8…` | **unchanged** `e7b604b8…` |
| Synthetic values in datasets XML | absent | **absent** |
| Adobe visible rendering source | XFA-bound | still bound to empty datasets |

**Conclusion:** iText Core AcroForm fill created a **desynchronized dual representation**. Inspection tools reading AcroForm `/V` reported success; Adobe reading XFA datasets reported failure.

Supporting evidence: `backend/storage/app/private/government-forms-poc/reports/IMM5476_deep_diff.json`

---

## 2. Authoritative form architecture (IMM 5476 11-2025)

| Property | Value |
|----------|-------|
| Technology | **XFA-hybrid** (Adobe Designer 6.2) |
| XFA config | `scriptModel=XFA`, `formModel=both`, `adobeExtensionLevel=11` |
| AcroForm widgets | 76 (mirrored field names) |
| XFA packets | preamble, config, template, localeSet, **datasets**, xmpmeta, xfdf, PDFSecurity, form, postamble |
| Save button | XFA script: `app.execMenuItem("SaveAs")` |
| Reset button | XFA script: `xfa.host.resetData()` |
| Print button | XFA script: `xfa.host.print(...)` |
| Reader extensions | `/Perms` → `/UR3` usage-rights signature (`ARE Production V8.1 G3 P24 5722`) |

Extracted artifacts:
- `reports/xfa-original/template.xml`
- `reports/xfa-original/datasets.xml`
- `reports/xfa-original/config.xml`

---

## 3. Original vs generated structural diff

### iText Core AcroForm (`IMM5476_itext_test.pdf`)

| Item | Changed? |
|------|----------|
| XFA datasets | **NO** (identical SHA-256) |
| XFA template/config/localeSet | NO |
| AcroForm `/V` | YES (7 fields) |
| Encryption | **YES — removed** |
| Producer metadata | YES — iText AGPL stamp |
| Document JavaScript (ADBE XFA checks) | preserved (3 blocks) |
| `/Perms/UR3` dictionary present | YES — but file bytes changed → signature integrity compromised |

### iText Core + appearance regeneration (`IMM5476_itext_acroform_appearance_test.pdf`)

Same as above: datasets unchanged, AcroForm `/V` populated, `/AP` regeneration reported success for all 7 fields programmatically — **does not fix XFA binding**.

Report: `reports/IMM5476_appearance_diff.json`

### iText pdfXFA append (`IMM5476_itext_pdfxfa_append_test.pdf`)

| Item | Changed? |
|------|----------|
| XFA datasets | **YES** — contains POCTEST and all 7 synthetic values |
| Encryption | **preserved** (`encryption_removed: false`) |
| AcroForm `/V` | not populated by this method |
| Template packet | unchanged |

Report: `reports/IMM5476_pdfxfa_append_diff.json`

### iText pdfXFA rewrite (`IMM5476_itext_pdfxfa_rewrite_test.pdf`)

| Item | Changed? |
|------|----------|
| XFA datasets | **YES** |
| Encryption | **removed** |
| UR3 signature integrity | likely broken (full rewrite) |

Report: `reports/IMM5476_pdfxfa_rewrite_diff.json`

### Aspose evaluation (`IMM5476_aspose_test.pdf`)

| Item | Result |
|------|--------|
| Aspose detected form type | `Static` (AcroForm), `has_xfa=false` |
| Fill method | AcroForm TextBoxField.setValue |
| Expected datasets update | likely same failure mode as iText Core — pending diff |

Report: `reports/IMM5476_aspose_diff.json`

---

## 4. Reader extensions / usage rights

Original PDF contains Adobe **UR3 usage-rights signature** granting Reader capabilities including:
- `/Document: [/FullSave]`
- `/Form: [/FillIn]`
- Annot create/modify/copy/import/export

Any third-party rewrite that reorganizes signed byte ranges **invalidates** this signature. Adobe then disables extended features (Save, some form scripts).

**Append-mode pdfXFA fill** is the architecturally correct experiment to preserve UR3 — but Adobe manual verification is still required.

**Production constraint:** We must not bypass, strip, or forge government/Adobe signatures. Legal review required for any workflow that modifies Reader-enabled IRCC PDFs.

---

## 5. Why Save / Reset / Print broke

These are **XFA event scripts** in the template, not simple AcroForm submit actions:

```xml
<!-- Save -->
app.execMenuItem("SaveAs");

<!-- Reset -->
xfa.host.resetData();

<!-- Print -->
xfa.host.print(1, "0", (xfa.host.numPages -1).toString(), 0, 0, 0, 0, 0);
```

They require:
1. Valid XFA runtime (`xfa.host`, `xfa_version >= 2.8`)
2. Intact XFA template + datasets binding
3. Valid Reader usage-rights where opening in Acrobat Reader (not full Acrobat Pro)

The iText Core rewrite likely broke (1)+(2) via dataset desync and (3) via signature/encryption changes.

---

## 6. Diagnostic matrix

| Test | Original baseline* | Core AcroForm | Core + AP regen | iText pdfXFA append | iText pdfXFA rewrite | Aspose AcroForm |
|------|-------------------|---------------|-----------------|---------------------|----------------------|-----------------|
| Values visible in Adobe | **PASS (expected)** | **FAIL (confirmed)** | **PENDING** | **PENDING** | **PENDING** | **PENDING** |
| Editable | PASS (expected) | FAIL | PENDING | PENDING | PENDING | PENDING |
| Save | PASS (expected) | FAIL | PENDING | PENDING | PENDING | PENDING |
| Reset | PASS (expected) | FAIL | PENDING | PENDING | PENDING | PENDING |
| Print | PASS (expected) | FAIL | PENDING | PENDING | PENDING | PENDING |
| XFA datasets updated | baseline empty | **NO** | **NO** | **YES** | **YES** | TBD |
| XFA preserved | baseline | YES (unchanged) | YES | YES (modified datasets only) | YES | TBD |
| AcroForm /V updated | baseline empty | YES | YES | NO | NO | YES (programmatic) |
| Actions preserved (structure) | baseline | template unchanged | template unchanged | template unchanged | template unchanged | TBD |
| Reader rights cryptographically valid | baseline valid | **likely invalid** | **likely invalid** | **best candidate** | **likely invalid** | TBD |
| Encryption preserved | YES | NO | NO | **YES** | NO | TBD |
| Adobe warnings | none expected | unknown | unknown | unknown | unknown | unknown |

\*Original baseline: user should confirm untouched official PDF passes all checklist items in Adobe Reader.

---

## 7. Adobe manual re-test files

Please test these in **Adobe Acrobat Reader** using `ADOBE_ACCEPTANCE_CHECKLIST.md`:

| File | Path |
|------|------|
| **Best candidate** | `output/IMM5476_itext_pdfxfa_append_test.pdf` |
| Failed baseline | `output/IMM5476_itext_test.pdf` |
| Appearance experiment | `output/IMM5476_itext_acroform_appearance_test.pdf` |
| Rewrite mode (likely bad) | `output/IMM5476_itext_pdfxfa_rewrite_test.pdf` |
| Aspose AcroForm | `output/IMM5476_aspose_test.pdf` |

---

## 8. `setUnethicalReading` status

Currently used only in **diagnostic PoC JAR** to write encrypted templates.

| Method | Can eliminate for production? |
|--------|-------------------------------|
| iText Core rewrite | No — still needs owner-password write access OR append-mode strategy |
| iText pdfXFA append | **Possibly yes** — append fill succeeded without full decrypt-write cycle; needs production-safe credential handling review |
| Aspose | Used empty password only in eval test |

**Production must not rely on permission bypass.** If IRCC templates require owner encryption, vendor must support compliant read/write under licensed API.

---

## 9. Licensing

| Engine | PoC status | Production SaaS |
|--------|-----------|-------------------|
| iText Core 8 (AGPL) | used | **Not acceptable** without commercial license |
| iText pdfXFA 3.0.3 | resolved + tested | **Separate commercial add-on** — legal review required |
| Aspose.PDF 25.2 eval | built + ran | **Commercial site license** — evaluation watermark may apply |

---

## 10. Recommended next step (R&D only)

1. **User Adobe-tests `IMM5476_itext_pdfxfa_append_test.pdf` first** — this is the only programmatic output that updated XFA datasets while preserving encryption.
2. If append passes Adobe: refine dataset XML generation from canonical resolver; never use Core AcroForm-only fill for this form family.
3. If append fails Adobe: investigate whether UR3 signature still invalid despite append; consult iText KB on Reader-enabled XFA; evaluate Aspose XFA-specific APIs (not AcroForm path).
4. **Do not start Phase B** until one method passes full Adobe checklist without flattening or permission bypass.

---

## 11. Files created/modified in this investigation

### New diagnostic tooling
- `form-processor-poc/python/deep_pdf_diff.py`
- `form-processor-poc/python/extract_xfa_packets.py`
- `form-processor-poc/fixtures/imm5476_synthetic_datasets.xml`
- `form-processor-poc/java-aspose/` (evaluation PoC)
- Extended `form-processor-poc/java-itext/ItextPocMain.java` — `fill-with-appearances`, `fill-xfa-datasets`

### Reports (private storage)
- `reports/IMM5476_deep_diff.json`
- `reports/IMM5476_appearance_diff.json`
- `reports/IMM5476_pdfxfa_append_diff.json`
- `reports/IMM5476_pdfxfa_rewrite_diff.json`
- `reports/IMM5476_aspose_diff.json`
- `reports/xfa-original/*` and `reports/xfa-itext/*`

### Generated test PDFs (private storage)
- `output/IMM5476_itext_acroform_appearance_test.pdf`
- `output/IMM5476_itext_pdfxfa_append_test.pdf`
- `output/IMM5476_itext_pdfxfa_rewrite_test.pdf`
- `output/IMM5476_aspose_test.pdf`

---

## 12. Phase B gate

**REMAINS BLOCKED.**

No production Government Forms module until Adobe manual acceptance passes on at least one non-flattened output using a licensing-approved engine/method.
