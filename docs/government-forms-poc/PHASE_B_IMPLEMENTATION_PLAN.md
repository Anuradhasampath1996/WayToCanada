# Phase B — Government Forms Production Implementation Plan

**Status:** APPROVED (Adobe acceptance PASS for IMM 5476 + IMM 5406)  
**Production deployment:** BLOCKED until commercial iText Core + pdfXFA licensing  
**Date:** 2026-09-01

---

## Executive summary

Phase B promotes the proven PoC architecture into RCICMaster production integration:

- **Engine:** iText Core + pdfXFA, XFA datasets + append mode
- **Scope:** Case-scoped generation via `CaseFile`
- **Source of truth:** Canonical RCICMaster data (not PDF fields)
- **First forms:** IMM 5476 → IMM 5406 (no other IRCC forms until stable)
- **UI:** Government Forms panel inside existing Consultant Case Hub

---

## Current repository baseline (post-PoC)

| Area | Location | State |
|------|----------|-------|
| PoC Java processor | `form-processor-poc/java-itext/` | Working (inspect, fill-xfa-datasets, compare) |
| PoC config/mappings | `backend/config/government_forms_poc.php` | IMM5476 synthetic mappings only |
| Engine contract (stub) | `backend/app/Contracts/GovernmentForms/GovernmentPdfEngine.php` | Interface only |
| IRCC catalog | `backend/app/Models/IrccFormCatalog.php` | Sync via `IrccFormsSyncService` |
| Package submissions | `backend/app/Models/IrccPackageDocumentSubmission.php` | Manual upload only |
| Prefill service | `backend/app/Services/QuestionnaireFormPrefillService.php` | Flat keys, user-scoped |
| Case scoping design | `docs/government-forms-poc/CASE_SCOPING.md` | Approved design |
| Case Hub UI | `frontend/Consultant Dashbord/.../case-management-client.tsx` | No gov forms panel yet |
| Secure PDF streaming | `backend/app/Http/Controllers/SecurePdfController.php` | Public disk only today |
| Workflow gate (existing) | `CaseFile.application_forms_verified_at` | Interactive forms reviewed |
| Step 3 persistence | `QuestionnaireStep3Data` + migration | Fixed |

### PoC compatibility matrix

| Form | Version | Technology | Engine | Automated | Adobe | Status |
|------|---------|------------|--------|-----------|-------|--------|
| IMM 5476 | 11-2025 | ACROFORM_XFA_HYBRID | pdfXFA append | PASS | PASS | SUPPORTED (PoC) |
| IMM 5406 | 05-2026 | XFA_DYNAMIC | pdfXFA append | PASS | PASS | SUPPORTED (PoC) |

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Consultant Case Hub UI                                         │
│  Government Forms panel (readiness, generate, download)         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ API
┌───────────────────────────▼─────────────────────────────────────┐
│  Laravel orchestration                                          │
│  FormGenerationService                                          │
│  FormReadinessService │ CanonicalDataResolver │ StaleFormDetector│
│  ApplicationInfoReviewService │ GovernmentFormRegistryService   │
└───────────────┬─────────────────────────────┬───────────────────┘
                │ HTTP (internal only)         │ private disk
┌───────────────▼───────────────┐   ┌─────────▼──────────────────┐
│  Java Form Processor Service    │   │  storage/app/private/      │
│  GovernmentPdfEngine impl       │   │  government-forms/         │
│  iText + pdfXFA append mode     │   │  generated/{case_id}/...   │
└───────────────────────────────┘   └────────────────────────────┘
```

**Boundary rule:** Application code depends on `GovernmentPdfEngine` contract and `FormProcessorClient`, never on iText APIs directly.

---

## Implementation stages (mandatory order)

### Stage A — Canonical / case-scoping foundation ✅ START

**Deliverables:**

| File | Purpose |
|------|---------|
| `CanonicalDataResolver` | `resolve(CaseFile): CanonicalDataSet` |
| `CanonicalDataSet` | Value object: values, source_hash, sources, case_file_id |
| `SourceDataHasher` | Deterministic SHA-256 of normalized canonical payload |
| `ApplicationInfoReviewService` | Review gate + snapshot creation |
| `CaseQuestionnaireSnapshotService` | Freeze questionnaire subset at review |
| Migration | `case_files`: review fields + snapshot JSON + hash |
| Enum | `ClientActivityType::APPLICATION_INFO_REVIEWED` |

**Canonical key namespace (examples):**

```
applicant.personal.family_name
applicant.personal.given_names
applicant.personal.date_of_birth
applicant.contact.email
applicant.passport.number
applicant.family.spouse.*
applicant.family.children[]
representative.personal.family_name
representative.rcic_number
representative.firm_name
```

**Data sources (precedence):**

1. Case questionnaire snapshot (if reviewed)
2. Live `QuestionnaireSubmission` (with stale warning if no snapshot)
3. `IrccInteractiveFormResponse` scoped to `case_file_id`
4. `ClientProfile` / `User` profile fields
5. Case consultant (`User` rcic fields)

**Gate:** `application_info_reviewed_at` + `application_info_reviewed_by` on `CaseFile`

**Prerequisites for generation (Stage E+):**

- Case exists
- Consultant authorized
- Client questionnaire/data available
- `application_info_reviewed_at` set
- Existing `application_forms_verified_at` (interactive forms) where pathway requires

---

### Stage B — Government form registry / version / mapping metadata

**Deliverables:**

| Table/Model | Purpose |
|-------------|---------|
| `government_form_versions` | Version-level metadata per official PDF |
| `government_form_mappings` | Canonical key → XFA/PDF path per version |
| Enums | `PdfTechnology`, `SubmissionMode`, `VersionStatus`, `MappingStatus` |
| `GovernmentFormRegistryService` | Version lookup, sync hash detection, status transitions |
| Extend `IrccFormsSyncService` | Detect template SHA-256 change → `MAPPING_REVIEW_REQUIRED` |
| Seeder | IMM 5476 v11-2025, IMM 5406 v05-2026 (PoC verified) |

**Separate concepts:**

- **PDF technology:** `ACROFORM`, `XFA_STATIC`, `XFA_DYNAMIC`, `ACROFORM_XFA_HYBRID`, `NON_INTERACTIVE`, `UNKNOWN`
- **Submission mode:** `PDF_AUTO_FILL`, `PDF_AUTO_FILL_ADOBE_VALIDATE`, `PDF_MANUAL`, `PORTAL_DIGITAL`, `NOT_APPLICABLE`

**Version immutability:** Never overwrite old templates. New hash → new version row, disabled until verified.

---

### Stage C — Private generation persistence

**Deliverables:**

| Change | Purpose |
|--------|---------|
| Extend `ircc_package_document_submissions` | Generation metadata columns |
| Drop unique `(case_file_id, ircc_category_document_id)` | Allow supersession chain |
| Enums | `GenerationType`, `GenerationStatus`, `ReviewStatus` |
| `StaleFormDetector` | Compare live hash vs stored `source_data_hash` |
| Private storage paths | `government-forms/generated/{case_file_id}/` |
| `SecurePdfController` extension | Stream from `local` disk with auth |

**Metadata columns:**

```
generation_type, government_form_version_id, mapping_version,
source_template_hash, source_data_hash, output_sha256,
generated_by, generated_at, review_status, supersedes_id,
generation_status, storage_disk
```

---

### Stage D — Production form-processor service boundary

**Deliverables:**

| Component | Purpose |
|-----------|---------|
| `form-processor-service/` (new) | Java 17 HTTP service (promote PoC, not copy) |
| Endpoints | `POST /inspect`, `POST /fill`, `POST /validate-structure` |
| Internal auth | Shared secret / internal network only |
| `FormProcessorClient` | Laravel HTTP client with timeout, error mapping |
| `ItextPdfXfaEngine` | `GovernmentPdfEngine` implementation |
| `config/government_forms.php` | Processor URL, paths, licensing notes |
| **Remove** | `setUnethicalReading(true)` from production |

**Rejected in production:** Core AcroForm-only fill, appearance regen primary, PyMuPDF writer, Aspose AcroForm for XFA, flattening, unethical reading.

---

### Stage E — IMM 5476 full backend integration

**Deliverables:**

- Verified `government_form_versions` row (11-2025, SHA-256 from PoC)
- Full canonical mappings + transformers
- `FormMappingService` + `XfaDatasetBuilder`
- `FormReadinessService` for IMM 5476 mandatory/conditional fields
- `FormGenerationService` orchestration
- API routes (consultant-only, case-scoped)
- Audit via `ClientActivityLog`
- Feature tests: auth, tenant isolation, generation, supersession

---

### Stage F — IMM 5476 Case Hub UI

**Deliverables:**

- Government Forms panel in `case-management-client.tsx`
- Application Information Reviewed status + action
- Per-form readiness, missing info links, generate/download/review
- Adobe validation note in UI
- No new top-level workflow step

---

### Stage G — IMM 5476 end-to-end verification

**Deliverables:**

- Integration test: processor health + IMM 5476 structural regression
- Manual Adobe checklist sign-off
- Compatibility matrix entry: `SUPPORTED`

**Gate:** Do NOT start Stage H until G passes.

---

### Stage H — IMM 5406 integration

**Deliverables:**

- Repeatable family mappings (spouse, parents, children)
- Overflow detection for capacity limits
- Same pipeline as IMM 5476
- Adobe acceptance for 05-2026 version

---

### Stage I — Regression / security suite

**Deliverables:**

- Unit tests: transformers, conditions, readiness, mappings, stale detection
- Feature tests: IDOR, cross-tenant, secure download, template tampering
- `docs/government-forms-poc/COMPATIBILITY_MATRIX.md`
- Security checklist documented

---

## Key services (production)

| Service | Responsibility |
|---------|----------------|
| `CanonicalDataResolver` | Case → canonical dot-notation values |
| `ApplicationInfoReviewService` | Review gate + snapshot |
| `GovernmentFormRegistryService` | Version catalog, hash sync |
| `FormMappingService` | Canonical → XFA paths + transformers |
| `FormReadinessService` | Mandatory/conditional readiness |
| `FormGenerationService` | Full orchestration pipeline |
| `StaleFormDetector` | Outdated generation detection |
| `FormProcessorClient` | Internal Java service HTTP |

## Transformers (Stage E)

`DateTransformer`, `BooleanTransformer`, `CheckboxTransformer`, `RadioTransformer`, `DropdownTransformer`, `CountryTransformer`, `ProvinceTransformer`, `PhoneTransformer`, `NameTransformer`, `AddressTransformer`

---

## Security requirements

- Cross-consultant / cross-tenant access denied
- No public URLs for filled PDFs
- Processor receives only registry-approved template IDs
- No PII in ordinary logs
- Temp file cleanup
- Source/output hash verification

---

## Licensing blocker (non-code)

Before production deployment:

1. Obtain iText Core commercial license
2. Obtain pdfXFA commercial license
3. Configure licensed runtime in container build
4. Remove AGPL/evaluation artifacts from production
5. Document deployment model

Development may continue on evaluation/dev licensing.

---

## Completion criteria

Phase B is complete when IMM 5476 AND IMM 5406 each satisfy:

- [ ] Case Hub display
- [ ] Readiness calculated with missing field identification
- [ ] Canonical mapping works
- [ ] Generated via processor, stored privately
- [ ] Secure download
- [ ] Adobe-compatible output
- [ ] Audit recorded
- [ ] Review lifecycle works
- [ ] Repeatable data (IMM 5406)
- [ ] Architecture: case-scoped, versioned, hashed, stale detection, tenant-safe, tested

---

## File inventory (planned new/modified)

### Backend (new)

```
app/Data/GovernmentForms/CanonicalDataSet.php
app/Enums/GovernmentForm*.php (5 enums)
app/Models/GovernmentFormVersion.php
app/Models/GovernmentFormMapping.php
app/Services/GovernmentForms/CanonicalDataResolver.php
app/Services/GovernmentForms/ApplicationInfoReviewService.php
app/Services/GovernmentForms/CaseQuestionnaireSnapshotService.php
app/Services/GovernmentForms/SourceDataHasher.php
app/Services/GovernmentForms/GovernmentFormRegistryService.php
app/Services/GovernmentForms/FormProcessorClient.php
app/Services/GovernmentForms/FormGenerationService.php (Stage E)
app/Services/GovernmentForms/FormReadinessService.php (Stage E)
app/Services/GovernmentForms/FormMappingService.php (Stage E)
app/Services/GovernmentForms/StaleFormDetector.php
app/Services/GovernmentForms/Transformers/*.php (Stage E)
app/Implementations/GovernmentForms/ItextPdfXfaEngine.php (Stage D)
config/government_forms.php
database/migrations/2026_09_01_100*.php (4 migrations)
database/seeders/GovernmentFormVersionSeeder.php
tests/Unit/GovernmentForms/*.php
```

### Java (Stage D)

```
form-processor-service/  (promote from form-processor-poc/java-itext)
```

### Frontend (Stage F)

```
Consultant Dashbord/.../government-forms-panel.tsx (new component)
case-management-client.tsx (integrate panel)
```

---

## Immediate next actions

1. ✅ This plan document
2. 🔄 Stage A implementation (in progress)
3. Stage B registry migrations + seeder
4. Stage C persistence extension
5. Stage D Java service HTTP wrapper
