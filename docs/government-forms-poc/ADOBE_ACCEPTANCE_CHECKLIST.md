# Adobe Acrobat Reader — Manual Acceptance Checklist (PoC D)

Test generated output files in **current Adobe Acrobat Reader** on Windows.

## IMM 5476 — PASS (2026-09-01)

File: `IMM5476_itext_pdfxfa_append_test.pdf`  
Strategy: iText pdfXFA + append mode

| # | Check | Result |
|---|-------|--------|
| 1 | File opens without repair/corruption warning | PASS |
| 2 | Populated values visible | PASS |
| 3 | Editable fields remain editable | PASS |
| 4 | Save works | PASS |
| 5 | Save → close → reopen retains values | PASS |
| 6 | Reset Form works | PASS |
| 7 | Print Form works | PASS |
| 8 | Signature fields behave normally | PASS |

## IMM 5406 — PASS (Stage H, confirmed 2026-09-01)

File: `docs/government-forms-poc/stage-h/artifacts/IMM5406-StageH-10.pdf`  
Strategy: iText pdfXFA + append mode (same as 5476)

| # | Check | Result |
|---|-------|--------|
| 1 | Actual IMM 5406 renders | PASS |
| 2 | Synthetic populated values visible | PASS |
| 3 | Fields editable | PASS |
| 4 | Save works | PASS |
| 5 | Save → close → reopen retains values | PASS |
| 6 | Reset works | PASS |
| 7 | Print works | PASS |
| 8 | Validate works | PASS |
| 9 | Repeatable/family sections and validation messages behave normally | PASS |
| 10 | No repair/corruption/security warning; layout intact | PASS |

## Live batch — 2026-09-08 — **ADOBE UI PASS** (operator confirmed)

Folder: `docs/government-forms-poc/adobe-live-check-20260908-122740/`  
Synthetic marker: **ADOBECHECK** (+ travel `Singapore`, languages Sinhala/English)  
Generate: `php backend/artisan_live_generate_adobe.php`  
Dataset smoke: `python docs/government-forms-poc/verify_adobe_live_datasets.py`  
UCI note: values are digits-only (hyphens stripped) — earlier `11-2222-3333` caused Adobe “Numeric characters” warnings.

| Form | Live generate | Dataset values | Adobe UI (open/edit — no format errors) |
|------|---------------|----------------|------------------------------------------|
| IMM 0008 | OK | OK | **PASS** |
| IMM 5562 | OK | OK | **PASS** |
| IMM 5669 | OK | OK | **PASS** |
| IMM 1294 | OK | OK | **PASS** |
| IMM 1295 | OK | OK | **PASS** |
| IMM 5707 | OK | OK | **PASS** |

Operator confirmed 2026-09-08: all PDFs opened with **no validation errors** shown.

## Rejected outputs (do not retest for production)

- `IMM5476_itext_test.pdf` — Core AcroForm FAIL
- `IMM5476_itext_acroform_appearance_test.pdf`
- `IMM5476_aspose_test.pdf`

**PoC pass criterion:** populated official-format PDF opens in Acrobat, retains values on reopen, and does not break required government form behaviour.

Automated backend tests alone are **not sufficient** for XFA acceptance.
