# Shared Learning Marketplace — verification

**Date:** 2026-09-14 (Phase 8C LMS AI factory)  
**Plan:** `docs/plans/shared-learning-marketplace/PLAN.md`  
**Approval:** R1–R80 locked (R20 replaced); R81–R86 locked; O1–O21 as recommended; **O22–O24 as replaced**.  
**Production:** **not deployed.** Frozen tag `rc-case-handling-phase-0-6` unchanged. No `migrate:fresh` on product `db_cws` / `db_lms` / `db_academy`.

**Release status:** see `docs/plans/shared-learning-marketplace/RELEASE-READINESS.md`.  
**Credentialed staging steps:** `docs/plans/shared-learning-marketplace/STAGING-VALIDATION-CHECKLIST.md`.  
**Phases 1–9 are not 100% complete.** PHPUnit is green offline. Real-provider golden path, Stripe test-mode Checkout, and browser mock matrix were **not** run (`OPENAI_API_KEY` empty; Stripe/Manus unset).

Accuracy target is **maximum verifiable accuracy**. The product does **not** claim 100% AI accuracy, guaranteed correctness, or a model-generated “AI accuracy = N%”.

---

## How to apply locally (not production)

```bash
cd backend
php artisan migrate
```

Additive migrations only:

| File | Database |
|------|----------|
| `2026_09_14_180000_create_learning_marketplace_academy_tables.php` | `db_academy` |
| `2026_09_14_181000_create_learning_marketplace_lms_tables.php` | `db_lms` |
| `2026_09_14_182000_create_learning_course_payments_table.php` | `db_cws` |
| `2026_09_14_190000_create_lms_ai_satellite_tables.php` | `db_lms` |

PHPUnit uses `db_cws_test` / `db_lms_test` / `db_academy_test` on `127.0.0.1:5433` (`wtc_postgres_test`). Test helpers still refuse to wipe any non-test database.

---

## Locked accuracy pipeline (implemented)

Exam Master → Exam Evidence Research Pack → Manus candidate research (notes only) → OpenAI independent fact cross-check (stored separately) → allow-list → retrieval → verify → classify → permitted snapshot/reference → conflict + currency checks → Admin pack approval → Evidence Summary → Generate Full Course → evidence-grounded blueprint → human blueprint approval → lessons / original MCQs / cases → eight-pass flags → coverage + mock-bank sufficiency → **draft** import → human review → **human publish**.

AI **cannot** publish (`AcademyAiGuard::denyPublish` / `LmsAiGuard::denyPublish`). Client LMS `generate-course` is **not** a stub: it persists `lms_ai_generation_jobs` and imports draft rows into `db_lms` via `LmsAiDraftImporter`.

---

## O22–O24 (replaced, implemented)

| ID | Behaviour |
|----|-----------|
| **O22** | Admin-entered structure is `admin_asserted`, not `verified`. Generate Full Course requires at least one **verified official authority/board** source. Missing mock-critical values → `critical_structure_unverified` and block the affected mock. |
| **O23** | Stale on newer official version, newer effective date, authority change notice, source removed/replaced, hash change, **or** profile interval expiry. Defaults: RCIC/citizenship 90 days; language 180 days (configurable). Store `next_review_at` + `stale_reason`. |
| **O24** | `robots.txt` is **not** reuse permission. Full-file snapshot only when `usage_permission_status=official_public_reuse_allowed`. Otherwise URL + hash + excerpt + pattern metadata. |

---

## Admin / learner surfaces

| Surface | Path | Status |
|---------|------|--------|
| Exam Master + Research / Evidence | Admin `/admindashboard/learning/exams` | Complete |
| APIs | `/api/v1/admin/learning/exams*` | Complete |
| Locale | `PATCH /api/v1/me/locale`, `GET /api/v1/learning/i18n` | Complete |
| Learning Checkout | `POST /api/v1/learning/checkout` (`type=learning_course`, `mode=payment`) | Backend complete; **no live Stripe test-mode run** |
| RCIC Academy catalog | Consultant `/dashboard/academy/courses` | Complete (this pass) |
| Academy mock player + results | `/dashboard/academy/exams` | Complete (this pass) |
| Client Learning Marketplace | `/user-dashboard/learning` | Complete (this pass) |
| Client Exam Master player | `/user-dashboard/learning/mocks/[attemptId]` | Complete (this pass) |
| Consultant locale toggle | Academy shell EN/FR | Complete |

---

## Tests run

PHPUnit: Docker Postgres `:5433`.

### Learning marketplace / Evidence Pack (`LearningMarketplaceTest`)

Originally **30** tests. Release-readiness pass added **6**. Blocker-close pass added **1** (`test_random_pool_twenty_ten_attempt_matrix`). Class total **37**.

**Full class (required):** `php -d output_buffering=Off artisan test tests/Feature/Learning/LearningMarketplaceTest.php --testdox`  
**Result: 37 passed (158 assertions), 713.93s, OK.**

### Client LMS AI factory (`LmsAiGenerationTest`) — Phase 8C

**Full class:** `php -d output_buffering=Off artisan test tests/Feature/Learning/LmsAiGenerationTest.php --testdox`  
**Result: 10 passed (112 assertions), 268.93s, OK.**

Offline only: fake OpenAI/Manus/Stripe, `Http::preventStrayRequests()`. Does **not** mark `CITIZENSHIP AI SMOKE: PASS`.

Stub replacement: `POST .../generate-course?product_domain=client_lms` returns `job_id` + `status=blueprint`, **not** `LMS generation job accepted as draft factory`. After mocked `approve-blueprint`, the job reaches `draft_ready` with real `db_lms` rows.

Exact mocked import counts (smoke request `module_count=1`, `lesson_count=2`, `independent_count=10`, `mock_question_count=10`):

| `db_lms` artifact | Count / assertion |
|-------------------|-------------------|
| `lms_ai_generation_jobs` | 1 persisted job, `citizenship_exam_prep`, `product_domain=client_lms` |
| `lms_courses` | 1, `is_published=false`, `review_status=content_review`, `exam_id` set |
| `lms_modules` | 1 |
| `lms_lessons` | 2 |
| `lms_exam_questions` | 10, all `draft`, matching `exam_id` + `generation_job_id` |
| `lms_course_questions` | 10, `practice_eligible` + `mock_eligible` |
| `lms_exam_templates` | 1, `random_pool`, same `exam_id` + `course_id`, `status=draft`, `total_questions=10` |
| `db_academy` courses/modules/lessons/questions | **unchanged** (zero new rows) |
| `academy_ai_generation_jobs` | **unchanged** |

Cross-domain / gate assertions in the same class:

| # | Proof |
|---|--------|
| 1–2 | LMS writes only `db_lms`; Academy content counts unchanged |
| 3 | Captured provider systems use `LmsAiPromptCatalog` (`Client LMS` / `citizenship_exam_prep`), not `You are an RCIC Academy authoring assistant` |
| 4 | `rcic_exam_prep` on `lms_exams` → 422 `profile_domain_mismatch` |
| 5 | `citizenship_exam_prep` on `academy_exams` → 422 `profile_domain_mismatch` |
| 6 | Missing Evidence Pack → 422 `minimum_evidence_missing`; no job row |
| 7 | Blocking conflict → 422 `exam_source_conflict`; no job row |
| 8–17 | Draft course/modules/lessons/non-empty bank/`exam_id`/pivot/eligibility/mock template/`random_pool` |
| 18 | Requested 1/2/10 counts stored on `request_json` and imported |
| 19 | Retry does not duplicate course/module/lesson/question/pivot/template |
| 20 | `POST .../lms-ai-jobs/{id}/publish` → 422; AI cannot publish |
| 21 | `content_language=fr` → `review_status=language_review` (no CICC legal review) |
| 22 | Legacy LMS catalog + assigned `GET /client/lms/courses` still green |
| 23 | Academy RCIC prompt catalog unchanged; spot-check `AcademyAiContentTest::test_admin_can_create_generation_request` **PASS** (1 test, 3 assertions) |

Do **not** treat this mocked PHPUnit class as `CITIZENSHIP AI SMOKE: PASS`. That status requires a real provider run (`STAGING-VALIDATION-CHECKLIST.md`).

Root cause of earlier no-output “hang”: per-test `dropAllTables` on `db_lms_test` / `db_academy_test` plus PHPUnit stdout buffering; process was killed before a result printed. Resolution: wipe satellites once per process, truncate afterwards, fake OpenAI/Manus/Stripe, `Http::preventStrayRequests()`. See `RELEASE-READINESS.md` §0.

Covers R80 1–24 plus extended 25–34 including:

- pack required before generation
- official host classification
- unverified leak cannot be verified
- official sample pattern analysis + hash
- source conflict blocks generation
- newer official source resolves conflict
- Manus notes do not write Exam Master
- OpenAI disagreement recorded separately
- model agreement without official source is **not** verified
- `admin_asserted` ≠ `verified`
- blueprint without evidence pack throws
- MCQ provenance
- validator prompt has no generated `is_correct`
- `low_exam_relevance` / `style_mismatch`
- `coverage_gap` / Insufficient Question Pool
- refresh does not silent-overwrite
- audited non-critical override
- AI cannot publish
- immediate stale on new official version / hash change
- profile `next_review_at`
- robots.txt ≠ reusable
- unknown permission not fully mirrored
- critical stale blocks generation
- Evidence Summary states
- exam-scoped bank + frozen option order
- `learning_course` fulfillment does **not** create a platform subscription
- French metadata fallback
- Academy catalog Buy Now without subscription
- LMS catalog excludes RCIC and does not require pathway
- payment-mode webhook routes `learning_course` and is idempotent
- refund revokes entitlement
- result dashboard fields after submit
- LMS Exam Master frozen options; keys hidden in progress
- 20/10 `random_pool` Attempts A/B/C engine matrix (refresh, expiry, duplicate submit, weighting)

### Academy regressions (blocker-close pass)

| Suite | Result |
|-------|--------|
| `AcademyFeatureTest` | **14 passed** (restored `grant_required` 403 on course show; catalog Buy Now remains `assertLearner`) |
| `AcademyAiContentTest` | 31 passed, 1 skipped (Manus webhook OpenSSL on Windows) |
| `AcademyStaffAccessTest` | Green |

### Providers

| Provider | PHPUnit | This machine live smoke |
|----------|---------|-------------------------|
| OpenAI | Fake / empty key / stray HTTP forbidden | **NOT CONFIGURED** |
| Manus | Disabled in phpunit.xml | **NOT CONFIGURED** (`MANUS REAL-PROVIDER SMOKE PENDING`) |
| Stripe | `FakeStripePlatformClient` | **NOT CONFIGURED** / **MOCK-VERIFIED ONLY — STAGING REAL STRIPE TEST REQUIRED** |

---

## Explicitly not done

- Production deploy / ECR / EC2
- `migrate:fresh` anywhere
- Merging Academy and LMS learner data
- Real IRB Evidence Pack → course generation smoke (**NOT CONFIGURED**)
- Manual lesson/MCQ audit of generated smoke content (**no artifact**)
- Live Stripe Checkout/webhook against test-mode keys (**NOT CONFIGURED**)
- Random mock **browser** matrix (engine 20/10 A/B/C PHPUnit passed)
- Client LMS `citizenship_exam_prep` **live** AI smoke (mocked PHPUnit factory is implemented; real provider still required)
- Synthetic listening audio / speaking scoring (schema-ready only)

---

## Env notes

No new required secrets. Optional:

| Variable | Default |
|----------|---------|
| `LEARNING_RCIC_EVIDENCE_DAYS` | 90 |
| `LEARNING_CITIZENSHIP_EVIDENCE_DAYS` | 90 |
| `LEARNING_LANGUAGE_EVIDENCE_DAYS` | 180 |
| `CLIENT_DASHBOARD_URL` | used for LMS Checkout success/cancel URLs |

Academy AI still uses existing `ACADEMY_AI_*` / `OPENAI_API_KEY`. Keys are never stored on Evidence Pack rows.
