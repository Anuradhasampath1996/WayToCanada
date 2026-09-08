# Government Form Generation — Multi-Case Client Data Scoping

## Problem

`QuestionnaireSubmission` is keyed by `user_id` (one record per client user), while `CaseFile` supports multiple cases per `ClientProfile`. Government form generation is **case-scoped** (`CaseFile`), but canonical applicant data currently lives in a **user-global** questionnaire.

**Risk:** Client has Case A (Express Entry) and Case B (Study Permit). Questionnaire updates for Case B could cause Case A form regeneration to use wrong data.

## Minimum safe solution (Phase B design — no broad questionnaire redesign)

### 1. Generation scope

All generation APIs operate on `CaseFile $caseFile` with consultant authorization on `$caseFile->client_profile_id`.

### 2. Canonical resolver signature

```php
CanonicalDataResolver::resolve(CaseFile $caseFile, ?Carbon $asOf = null): CanonicalDataSet
```

Returns:
- `values` — dot-notation canonical keys
- `source_hash` — SHA-256 of normalized canonical payload used for generation
- `sources` — which entities contributed (questionnaire, interactive forms, case overrides)
- `case_file_id`, `resolved_at`

### 3. Case binding without duplicating the whole questionnaire

**Phase B minimum:** Add optional `case_files.questionnaire_snapshot` JSON column (or `case_questionnaire_snapshots` table):

| Column | Purpose |
|--------|---------|
| `case_file_id` | FK |
| `snapshot_data` | Frozen subset of questionnaire relevant to this case |
| `source_questionnaire_updated_at` | Timestamp of source questionnaire when snapshotted |
| `snapshot_hash` | SHA-256 |
| `created_by` | consultant/system |
| `reason` | `case_opened`, `pre_generation`, `manual_freeze` |

**When to snapshot:**
- Consultant marks "Application information reviewed" for that case (recommended gate)
- OR automatically on first government-form generation attempt

**Resolver precedence for a case:**
1. Case snapshot (if present and not stale policy override)
2. Live questionnaire (with explicit "stale" warning if snapshot missing)
3. Interactive form responses scoped to `case_file_id`
4. Consultant/user profile fields

### 4. Generated artifact immutability

Each generated PDF record stores:
- `source_data_hash` at generation time
- `template_sha256`, `mapping_version`
- `supersedes_id` for regeneration chain

If live canonical data hash ≠ stored hash → UI shows **"Generated form may be outdated — regenerate"**.

Previous PDFs remain immutable.

### 5. What we do NOT do in PoC

- No full per-case questionnaire rewrite
- No duplicate client database
- No silent merge of Case B data into Case A

### 6. `IrccPackageDocumentSubmission` vs new model

**Extend `IrccPackageDocumentSubmission`** for Phase B if we add columns:

- `generation_type` (`manual_upload` | `auto_fill`)
- `template_sha256`, `mapping_version`, `source_data_hash`, `output_sha256`
- `review_status`, `supersedes_id`
- `storage_disk` = `local` (private), never `public` for filled forms

Avoid a separate `GeneratedGovernmentForm` table unless these concepts cannot fit cleanly (likely they can fit with migration).

### 7. Private storage rule

| Asset | Storage |
|-------|---------|
| Official blank templates | `public` or dedicated templates disk (no PII) |
| Generated filled forms | **`local` private disk only** — `storage/app/private/government-forms/generated/{case_file_id}/...` |
| Download | `SecurePdfController` pattern — auth + ownership + streamed response |

Never expose filled forms via predictable public URLs.
