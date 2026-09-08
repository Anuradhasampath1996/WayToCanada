# Government Forms PoC — IMM 5476 Report

## Status: `TECHNICAL_POC_PASS`

| Property | Value |
|----------|--------|
| Form code | IMM 5476 (11-2025) |
| Engine | **iText pdfXFA 3.0.3** + iText Core 8.0.5 |
| Write strategy | **XFA datasets + append mode** |
| Adobe acceptance | **PASS** (2026-09-01 manual test) |
| Encryption | PRESERVED |
| Interactive behaviour | PRESERVED (Save, Reset, Print, editable) |
| Flattening | NO |
| Production ready | **NO** — licensing + integration pending |

Reproducible reference: `IMM5476_PDFXFA_APPEND_REFERENCE.md`

---

## 1. Official source

| Item | Value |
|------|-------|
| Official page | https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5476.html |
| Version label | **11-2025** |
| Official PDF URL | https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5476/01-11-2025/imm5476e.pdf |
| Template SHA-256 | `aca5c476b93d1c496b1afbc2cfe843499e852e31dcf0c192153bd01f8d6c56c4` |

## 2. Detected PDF technology

| Check | Result |
|-------|--------|
| PDF version | 1.7 |
| Technology | **XFA-hybrid** (formModel both, scriptModel XFA) |
| AcroForm widgets | 76 |
| XFA packets | 10 (including datasets) |
| Reader extensions | UR3 usage-rights signature |

## 3. Adobe acceptance (PASS)

Test file: `IMM5476_itext_pdfxfa_append_test.pdf`

All criteria passed per manual Adobe Acrobat Reader test (2026-09-01).

## 4. Rejected approaches

| Approach | Adobe result |
|----------|-------------|
| iText Core AcroForm `/V` | FAIL |
| iText Core + AP regeneration | FAIL (expected) |
| Aspose AcroForm | FAIL (datasets unchanged) |

Root cause analysis: `ADOBE_FAILURE_INVESTIGATION.md`

## 5. Regression tests

- `backend/tests/Unit/GovernmentFormsImm5476RegressionTest.php` — **PASS**
- `form-processor-poc/python/validate_pdfxfa_output.py`

Automated tests do **not** replace Adobe manual acceptance.

## 6. Licensing

Commercial iText Core + pdfXFA required for production SaaS. AGPL PoC build is not production-ready.

## 7. Proceed to Phase B?

**Not yet.** Second complex form PoC (IMM 5406) must pass Adobe acceptance first.

See `STATUS.md` and `SECOND_POC_IMM5406.md`.
