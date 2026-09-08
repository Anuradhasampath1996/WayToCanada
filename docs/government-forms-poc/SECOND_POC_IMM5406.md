# Second PoC — IMM 5406 (Complex Form Stress Test)

## Why IMM 5406 was selected

### RCICMaster pathway analysis

| Pathway | Priority in product | Forms in IRCC category tree | Portal vs PDF |
|---------|---------------------|----------------------------|---------------|
| **Express Entry** | Highest (CRS, draws, questionnaire) | `Online Web Forms` only | **Portal-native** — no PDF IMM 0008 |
| **PNP (Non-EE)** | Supported in category tree | IMM 0008 + IMM 5669 | PDF |
| **Study / Work / Visitor** | Supported | Various PDF kits | PDF |

**Express Entry is the highest-priority product pathway**, but its assigned IRCC package is **online-only** (`IrccCategorySeeder`: forms = `['Online Web Forms']`). Building a PDF generator for IMM 0008 would be unnecessary for that workflow.

**IMM 5406** was chosen as the second PoC because it:

1. Is listed in `CaseManagementHubService` fallback forms for **Express Entry** supporting PDFs (alongside 5669, 5562)
2. Is a **current official PDF** (05-2026) actually downloaded from Canada.ca
3. Exercises architecture dimensions IMM 5476 does not:
   - **Pure XFA** (0 AcroForm widgets — harder than 5476 hybrid)
   - **`validateFields()` JavaScript** validation in template
   - **Repeatable family sections** (Section B/C relatives)
   - **Email format validation** scripts
   - Larger template (258 KB XFA template vs 246 KB for 5476)

**IMM 5669** was considered but deprioritized: official template has **no `datasets` packet** (pure dynamic XFA only), making it a different integration pattern than the proven append-mode datasets approach.

---

## Official source (verified)

| Item | Value |
|------|-------|
| Form | IMM 5406 E — Additional Family Information |
| Official page | https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5406.html |
| Version | **05-2026** (path segment `01-05-2026`) |
| Page last updated | May 2026 |
| Official PDF URL | https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5406/01-05-2026/imm5406e.pdf |
| Template SHA-256 | `4f544818e48b7355b2b7bb0dc89feed47fdd7e7ce836075b5d3c9489ed315b27` |
| Pages | 1 |
| Encryption | Standard V4 R4 128-bit AES |

---

## Detected technology

| Check | Result |
|-------|--------|
| Primary technology | **Pure XFA** (Adobe Designer 6.5) |
| AcroForm widgets | **0** |
| XFA packets | config, template, localeSet, datasets, xmpmeta, xfdf, PDFSecurity, form |
| Dynamic/static | Static shell with **repeatable subforms** in template |
| JavaScript validation | **YES** — `validateFields()`, `validateEmail()` |
| 2D barcode | **Not detected** in template inspection |
| Reader extensions | Expected UR3 (same class as IMM 5476) |

---

## PoC implementation

### Synthetic datasets fixture

`form-processor-poc/fixtures/imm5406_synthetic_datasets.xml`

Populated fields (applicant Section A):
- FamilyName: `POCTEST`
- GivenNames: `Synthetic Applicant`
- DOB: `1990-01-15`
- COB, Address, MaritalStatus, Email: synthetic values

### Generation command

```bash
java -jar form-processor-poc/java-itext/target/government-form-poc-itext-0.1.0-SNAPSHOT.jar fill-xfa-datasets \
  backend/storage/app/private/government-forms-poc/templates/official/imm5406-official-4f544818e48b.pdf \
  form-processor-poc/fixtures/imm5406_synthetic_datasets.xml \
  backend/storage/app/private/government-forms-poc/output/IMM5406_itext_pdfxfa_append_test.pdf \
  append
```

### Structural validation result

Report: `reports/IMM5406_pdfxfa_append_diff.json`

| Check | Result |
|-------|--------|
| Datasets updated | **YES** |
| POCTEST in datasets | **YES** |
| Synthetic Applicant in datasets | **YES** |
| poc.test@example.invalid in datasets | **YES** |
| Page count unchanged | YES (1) |
| Encryption preserved | **YES** |
| Flattened | NO |

### Adobe acceptance

**PENDING** — manual test required on:

`backend/storage/app/private/government-forms-poc/output/IMM5406_itext_pdfxfa_append_test.pdf`

Additional checklist items for IMM 5406:
- Run form **Validate** (if button present) after filling
- Test **repeatable relative sections** if adding more synthetic rows later
- Confirm email validation scripts behave with populated email field

---

## Phase B gate

Full Phase B remains **BLOCKED** until IMM 5406 Adobe manual acceptance passes.

If IMM 5406 passes → recommend **iText Core + pdfXFA (commercial)** as production engine.

If IMM 5406 fails → investigate before building production sidecar.
