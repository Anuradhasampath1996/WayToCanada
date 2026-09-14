# Shared Learning Marketplace — Release Readiness

**Date:** 2026-09-14 (Phase 8C LMS generate-course factory)  
**Plan:** `docs/plans/shared-learning-marketplace/PLAN.md`  
**Companion:** `docs/plans/shared-learning-marketplace/VERIFICATION.md` · **Staging checklist:** `docs/plans/shared-learning-marketplace/STAGING-VALIDATION-CHECKLIST.md`  
**Production deploy:** **not authorized and not performed.**  
**`migrate:fresh`:** **not used** on product `db_cws` / `db_lms` / `db_academy`.  
**Frozen RCIC case-handling:** tag `rc-case-handling-phase-0-6` at `900cf3683d976527da3b7f91a91b945b50995f0e` **unchanged**.

This document is the Release Readiness / End-to-End Smoke Phase. Architecture and automated tests are strong. **Phases 1–9 are not 100% complete** where real providers, live Stripe test-mode, or browser click-through are still pending. Status below is the honest classification.

Accuracy target remains **maximum verifiable accuracy**. The product does **not** claim 100% AI accuracy.

---

## 0. Track A — `LearningMarketplaceTest` hang (root cause and resolution)

### Symptom

Two full-class runs of `php artisan test --filter=LearningMarketplaceTest` produced **no PHPUnit output** for ~8–11 minutes, then exited **1** after the process was killed. Filtered subsets passed.

### Isolation (this pass)

| Check | Result |
|-------|--------|
| Last test started (debug run) | Tests ran in file order; first test **did** start (`test_patch_me_locale_persists`) |
| Last test completed before the only failure | `test_french_metadata_falls_back_to_english` on the debug run; full class later **completed** |
| DB | Docker `wtc_postgres_test` `:5433` healthy. No idle `pg_stat_activity` rows on test DBs at the start of diagnosis |
| Queue | `QUEUE_CONNECTION=sync` (phpunit.xml). No job wait loop |
| External HTTP | Not the hang. `Http::preventStrayRequests()` now enforced in `Tests\TestCase`. OpenAI/Manus/Stripe are faked or unbound from the network |
| Elapsed | Previous killed runs ~8–11 min with **no output**. After the fix, full class **713.93s (~12 min)** with an explicit PHPUnit result |
| Reproduces consistently? | The “no output / killed” behaviour reproduced twice before this pass. It was **not** a single infinite test. It **does not** reproduce as a hang once satellite DDL is no longer dropped on every test |

`--debug --testdox` on the still-slow class showed **every test completing**; PHPUnit in a non-TTY Cursor shell **buffers stdout**, so a 10+ minute class looks hung until it finishes or is killed.

### Causes ruled in / out

| Candidate | Finding |
|-----------|---------|
| Uncommitted CWS transaction leak | RefreshDatabase still wraps CWS. Not the silent hang |
| Postgres advisory / row deadlock wait | **Contributing** to satellite `dropAllTables`, not an infinite test. A later `AcademyFeatureTest` first-test `40P01` deadlock on `drop table ... cascade` confirmed AccessExclusiveLock vs AccessShareLock on `db_academy_test` |
| Cross-database transaction | CWS transacted; academy/LMS were DDL-dropped every test |
| `lockForUpdate()` forever | Not observed |
| Sync queue waiting | Not observed |
| Real OpenAI / Manus / Stripe HTTP | phpunit.xml already used fake AI drivers + empty Manus key. Stripe PHP SDK is **not** Laravel HTTP; `FakeStripePlatformClient` is now bound in `TestCase` |
| Webhook retry / polling / real `sleep` | Manus poll `timeout_seconds` forced to **0** in testing |
| Observer / recursive events | Not observed |
| Windows/Docker | **Yes** — per-test `dropAllTables` + recreate of `db_lms_test` / `db_academy_test` against Docker Postgres on Windows is slow (~16–20s setup per test). Combined with buffered PHPUnit output, the class was killed before a result printed |
| `artisan db:wipe --database=lms` | Previously avoided in marketplace setup because it hung; LMS wipe now uses schema drop/truncate, not `db:wipe` |

**Root cause:** `Tests\TestCase::refreshApplication()` dropped **all** LMS and Academy tables on **every** test. `LearningMarketplaceTest` then rebuilt both schemas (3 Academy migrations + LMS migrations + `AcademyBootstrap::ensure()` + `RolesAndPermissionsSeeder`) **37 times**. That is 10–12 minutes of DDL, not a stuck assertion. Non-TTY PHPUnit printed nothing until process end, so the run looked hung and was killed (exit 1).

### Resolution (tests only — no product features)

- Wipe satellite schemas **once** per PHPUnit process, before the first `migrate:fresh`.
- Later tests **TRUNCATE** satellite data (test DB names only) instead of `dropAllTables`.
- `resetAcademySchema()` truncates + re-bootstraps when tables already exist.
- `Http::preventStrayRequests()`; empty OpenAI keys; Manus disabled with 0s poll/timeout; `FakeStripePlatformClient` bound.
- Deadlock guard: terminate leftover backends on `db_lms_test` / `db_academy_test`, disconnect, retry `dropAllTables` on `40P01`.
- Recent-question weighting now orders `submitted_at desc, id desc` so tied timestamps are deterministic (Academy + LMS Exam Master).

### Full-class PHPUnit result (required)

```
php -d output_buffering=Off artisan test tests/Feature/Learning/LearningMarketplaceTest.php --testdox
```

**Tests: 37 passed (158 assertions)**  
**Duration: 713.93s**  
**OK (37 tests, 158 assertions)**

Do **not** treat filtered subsets as equivalent to this result.

---

## 1. Feature classification

Allowed labels: **Complete** · **Backend complete / frontend pending** · **Tested with mocks only** · **Real-provider smoke passed** · **Deferred by approved scope** · **Blocked**

| Feature | Status | Evidence / notes |
|---------|--------|------------------|
| Exam Master | **Complete** | Admin `/admindashboard/learning/exams`; APIs `/api/v1/admin/learning/exams*`; `academy_exams` / `lms_exams`. |
| Evidence Pack | **Tested with mocks only** | Pack ingest, classify, conflict, stale, Evidence Summary, generation gate: PHPUnit. **No real-provider pack was inspected this phase.** |
| Manus research | **Tested with mocks only** | Notes stored separately; cannot write Exam Master. Local `MANUS_ENABLED` / `MANUS_API_KEY` **unset**. One Academy AI Manus webhook test skipped on Windows OpenSSL. |
| OpenAI research cross-check | **Tested with mocks only** | Stored separately from Manus; agreement ≠ verified. Local `OPENAI_API_KEY` **empty**. |
| OpenAI course generation | **Tested with mocks only** | Academy + Client LMS orchestrators + importers gated on Evidence Pack. LMS `generate-course` is a real `db_lms` job (`LmsAiGenerationTest` 10/112). No live generate-course this phase. |
| Admin blueprint approval | **Complete** | Human approve required for Academy and LMS; AI cannot publish (`AcademyAiGuard` / `LmsAiGuard`). |
| Lesson generation | **Tested with mocks only** | Pipeline implemented. No generated smoke lessons to audit. |
| Question-bank generation | **Tested with mocks only** | Provenance, eight-pass flags, validator omits `is_correct`. No live bank. |
| Random mock generation | **Complete** (engine) / **Tested with fixtures** (20/10 A/B/C PHPUnit) / **browser pending** | `selection_mode=random_pool`, frozen `option_ids`. Engine matrix `test_random_pool_twenty_ten_attempt_matrix`. **No browser click-through.** |
| Admin manual editing | **Complete** | Existing Academy CMS: draft version, store lesson/question/case, update mock template. Generated rows are not locked. Published versions stay immutable via new draft. **Not click-tested on a live AI smoke course** (none generated). |
| RCIC catalog | **Complete** | Consultant **RCIC Academy** → Udemy-style grid, filters, real fields, CTA Buy/Continue/Renew/Start, no fake ratings. |
| Client LMS catalog | **Complete** | Client **Learning Marketplace**; self-purchase/free/assigned_or_purchase; RCIC profiles excluded. |
| EN/FR UI | **Complete** (shell + dictionaries) | `PATCH /me/locale`, `GET /learning/i18n`, LocaleToggle persist. French metadata falls back to English. **French generated RCIC legal content remains draft** (AI cannot publish). |
| Learning Checkout | **Backend complete** / **MOCK-VERIFIED ONLY — STAGING REAL STRIPE TEST REQUIRED** | `POST /api/v1/learning/checkout`, `mode=payment`, `type=learning_course`. Local Stripe keys **empty**. |
| Entitlement expiry | **Complete** (backend) | `access_months` default 3; `entitled_until` from backend. Refund sets Academy grant inactive / LMS assignment `expired`. Historical progress rows retained. |
| Mock player (RCIC Academy) | **Complete** | Server timer, navigator, flags, submit confirm, frozen set/options. |
| Results dashboard (Academy) | **Complete** | Real score, %, correct/incorrect/unanswered, time used, duration, attempt number, submitted at, readiness/performance labels. Topic/competency/difficulty charts omitted when empty. |
| Client LMS mock player | **Complete** for Exam Master mocks; legacy quizzes unchanged | `/user-dashboard/learning/mocks/[attemptId]`; `LmsExamMasterService` sitting semantics. |
| Stripe refund handling | **Tested with mocks only** | `charge.refunded` → `revokeLearningCourseFromCharge`. No live Stripe refund. |

**Do not describe Phase 1–9 as 100% complete.** Catalog/player work in this phase closed the previous frontend gaps. Real-provider golden path and real Stripe Checkout/webhook are still open.

---

## 2. RCIC golden-path smoke

**Preferred course:** `RCIC-IRB Specialization Exam`  
**Result:** **not executed with real providers.**

Local `.env` / process env this pass (values not recorded):

| Variable | Presence |
|----------|----------|
| `OPENAI_API_KEY` | empty / unset |
| `ACADEMY_OPENAI_API_KEY` | missing |
| `MANUS_API_KEY` / `ACADEMY_MANUS_ENABLED` | missing / unset |
| `STRIPE_SECRET` / `STRIPE_KEY` | missing |

No non-production OpenAI, Manus, or Stripe test-mode keys were configured in this environment. Keys were **not** copied from chat, Admin Integrations, or product `db_cws`.

**OpenAI real-provider smoke:** **NOT CONFIGURED**  
**Manus real-provider smoke:** **NOT CONFIGURED** — `MANUS REAL-PROVIDER SMOKE PENDING`  
Manus remaining optional: OpenAI-only functionality is not blocked by Manus absence, but the IRB golden path still needs an OpenAI key.

Automated substitutes (PHPUnit, mocked/fake providers) still cover pack gates, classification, conflicts, Manus notes ≠ Exam Master, OpenAI disagreement storage, AI cannot publish, exam-scoped random_pool.

No Exam Master / Evidence Pack / lesson / MCQ IDs were created on **product** databases for a live IRB smoke.

**Do not publish automatically:** still enforced.

---

## 3. Research quality (manual)

**Not performed on a real Evidence Pack** — no pack was generated with live Manus/OpenAI (`OPENAI_API_KEY` empty; Manus unset).

| Check | Result |
|-------|--------|
| Official authority | **Not inspected** (no live pack) |
| Official URLs | **Not inspected** |
| Current exam structure | **Not inspected** |
| Source dates | **Not inspected** |
| Conflicts | **Not inspected** on a live pack |
| Hashes | **Not inspected** on a live pack |
| Verification state | **Not inspected** |

Sample evidence from tests (not production data): official `college-ic.ca` host classified official; unverified past papers stay `unverified_exam_material`.

---

## 4. Lesson audit

**Not performed.** No AI-generated smoke lessons exist in this environment.

Reviewer decision: **FAIL** — blocked on real-provider generation.

| Lesson | Statement | supported | unsupported | citation mismatch | needs correction |
|--------|-----------|-----------|-------------|-------------------|------------------|
| *(none)* | — | — | — | — | No artifact |

---

## 5. MCQ audit

**Not performed** on a live generated bank. **FAIL** — blocked on real-provider generation.

| Q | Correct defensible? | Second correct possible? | Explanation | Citation supports? | Exam-relevant? | Difficulty | Too similar to official sample? | Validator agrees? |
|---|---------------------|--------------------------|-------------|--------------------|----------------|------------|---------------------------------|-------------------|
| *(none)* | — | — | — | — | — | — | — | No live validator run |

Automated: validator prompt must not include generated `is_correct`; eight-pass flags include `low_exam_relevance`, `style_mismatch`, near-past-paper. Validator disagreements from a live run: **none recorded** (no live run). Do not hide disagreements: **none to hide**.

---

## 6. Admin editing

Backend CMS already allows draft copies and new question/lesson/template rows. This phase did **not** mutate a generated IRB smoke course.

Expected behaviour (existing Academy workflow, not re-proven on live AI content):

| Edit | Status |
|------|--------|
| Course title / storefront / thumbnail | Supported on course + draft version |
| Lesson body | New draft version; published version immutable |
| MCQ stem / option / correct answer / explanation / difficulty / topic | New question version |
| Mock duration / counts / eligibility | `updateExamTemplate` |
| Generated content locked | **No** — AI cannot publish; humans edit drafts |

---

## 7. Random mock behaviour

**Engine matrix (PHPUnit, Carbon frozen — not a browser):** `test_random_pool_twenty_ten_attempt_matrix`

Bank: 20 published independent MCQs on `rcic_irb_specialization`. Mock: 10-question `random_pool`, 10 minutes.

| Check | Attempt A | Attempt B | Attempt C | Notes |
|-------|-----------|-----------|-----------|--------|
| Sets differ where possible | 10 ids | Disjoint from A (the other 10 unseen) | Prefer A’s 10 over more-recent B | Weighting `submitted_at desc, id desc` |
| Recent-question weighting | — | Unseen preferred | Lower weight for older A vs latest B | PASS |
| Refresh retains question ids | Same snapshot on two `show()` | — | — | PASS |
| Refresh retains option order | Frozen `option_ids` | — | — | PASS |
| Reopen retains attempt | Second `start()` returns same in-progress id | — | — | Engine equivalent of browser reopen — **not** a real browser tab |
| Timer retains `expires_at` | Server `expires_at` unchanged after later clock | — | — | PASS (`Carbon::setTestNow`) |
| No keys before submit | `correct_option_id` absent | — | — | PASS |
| Answer after expiry rejected | — | — | Extra sitting → 422; auto `time_expired` | PASS |
| Duplicate submit safe | Second submit 422 | — | — | PASS |
| Score computed once | 100% stays 100% after duplicate | — | — | PASS |
| Result values correct | 10 correct, 0 incorrect, 0 unanswered | — | — | PASS |

**Random mock browser matrix:** **FAIL** (not click-tested in a browser). Engine matrix: **PASS**.

Browser never receives the full bank: learner `show()` maps only snapshot question IDs.

---

## 8. Timer / submission

Academy + LMS Exam Master:

- `started_at` / `expires_at` from server
- `server_now` on show
- Refresh reloads the same snapshot
- Writes after expiry rejected (`422`); expiry auto-scores once (`compare-and-set`)
- HTTP duplicate submit: **422**
- `submission_reason`: `submitted` | `time_expired`

**Manual** local-clock skew, browser close/reopen, expiry+submit race: **not click-tested in a browser this phase.** Engine behaviour is covered by sitting services + marketplace tests.

---

## 9. Result dashboard

Academy `/dashboard/academy/exams` and LMS `/user-dashboard/learning/mocks/[attemptId]` render **real** attempt fields after submit:

score, percentage, correct, incorrect, unanswered, time used, total duration, attempt number, submitted at, readiness label, performance label.

Topic / competency / difficulty / independent vs case: shown only when scores exist.

PHPUnit: `test_exam_result_dashboard_fields_after_submit`.

---

## 10. RCIC Academy catalog UI

Implemented.

- Consultant Dashboard → **RCIC Academy** (`/dashboard/academy/courses`)
- Desktop: 3–4 cards (`md:grid-cols-3`, `lg:grid-cols-4`); mobile: 1
- Card fields from stored data: thumbnail, localized title/subtitle, target exam, language, difficulty, hours, price (only if `commerce_confirmed`), access months, entitlement status, CTA
- **No fake ratings** (`ratings` is always null)
- Filters: search, exam, language, price, status
- EN/FR via LocaleToggle + `/learning/i18n`
- CTA: Not purchased → Buy Now; Active → Continue Learning; Expired → Renew Access; Free → Start Course
- Catalog listing uses `assertLearner` (not full subscription surface) so Buy Now is reachable

---

## 11. Client LMS marketplace UI

Implemented.

- Client Dashboard → **Learning Marketplace** (`/user-dashboard/learning`)
- Catalog does **not** require pathway unlock
- `consultant_assigned` courses stay off the public catalog (`access_mode` filter)
- RCIC `generation_profile` / audience / domain courses are excluded
- Visible when published with self-purchase/free: Citizenship, IELTS, CELPIP, PTE, TEF, TCF (as stored categories/exams)
- Assigned “My courses” still listed when the client owns them

---

## 12. Client LMS Exam Master player

Implemented (additive; legacy `LmsExamService` quizzes unchanged).

- `LmsExamMasterService` + `/api/v1/client/lms/exam-templates/{template}/attempts` etc.
- Server timer, `random_pool`, frozen snapshot + option order, navigator, flags, submit summary, auto-submit, result dashboard, post-submit review when allowed
- Course player lists Exam Master templates and starts a sitting

---

## 13. Stripe test-mode E2E

**NOT CONFIGURED** — local `STRIPE_SECRET` / `STRIPE_KEY` missing. **Do not record `STRIPE TEST-MODE END-TO-END PASSED`.**

Still **MOCK-VERIFIED ONLY — STAGING REAL STRIPE TEST REQUIRED**.

PHPUnit (fake client / fulfillment objects, no Stripe network):

- Checkout metadata `type=learning_course`, `mode=payment`
- Success redirect **does not** grant access (webhook/fulfillment only)
- Webhook `checkout.session.completed` in payment mode routes `learning_course`
- Duplicate webhook event id is idempotent
- Academy purchase creates `AcademyEntitlement` (`one_time_purchase`), **not** `ConsultantSubscription`
- LMS purchase creates `LmsCourseAssignment` with `source=self_purchase`
- Refund revokes grant / expires LMS assignment; payment row retained as `refunded`
- Default access **3 months** (`config/learning.php`)

Not run against Stripe TEST MODE: Checkout → test payment → webhook → `learning_course_payments` → domain entitlement; failed card; live refund; Course A vs B isolation; success-URL-only grant.

---

## 14. French smoke

| Check | Result |
|-------|--------|
| UI locale EN → FR | LocaleToggle + `PATCH /me/locale` (PHPUnit persist + FR dictionary `verified` = Vérifié) |
| Locale persist | `users.locale` + `localStorage wtc_locale` |
| Marketplace labels FR | `/learning/i18n?locale=fr` |
| FR metadata when present | Catalog card localization |
| EN fallback | `test_french_metadata_falls_back_to_english` |
| FR UI buying EN content | Allowed (locale ≠ `content_language`) |
| FR generated RCIC stays draft | AI cannot publish; language/legal review still required |
| Official bilingual terminology | **Not audited** on generated copy (no generation) |

---

## 15. Client LMS AI smoke

**FAIL / NOT CONFIGURED** for the **real-provider** mark `CITIZENSHIP AI SMOKE: PASS`.

The previous **code** blocker (HTTP 201 stub `LMS generation job accepted as draft factory`) is **closed**. Offline PHPUnit now runs a real LMS job + `LmsAiDraftImporter` against fake providers.

| Layer | Result |
|-------|--------|
| Mocked PHPUnit factory (`LmsAiGenerationTest`) | **10 passed, 112 assertions, 268.93s** |
| Endpoint no longer stub | `job_id` persisted in `lms_ai_generation_jobs`; approve-blueprint imports `db_lms` drafts |
| Cross-domain write protection | Academy course/module/lesson/question counts unchanged |
| `citizenship_exam_prep` vs RCIC catalog | LMS systems are Client LMS; Academy catalog still RCIC |
| Live OpenAI/Manus citizenship generate | **NOT CONFIGURED** — do not mark `CITIZENSHIP AI SMOKE: PASS` |

Required live checks remain in `STAGING-VALIDATION-CHECKLIST.md` (official canada.ca pack, 1/2/10 draft import, no `db_academy` writes).

Classification: **Tested with mocks only** / live smoke **not executed**.

---

## 16. Verification evidence (this pass)

### Commands

```bash
cd backend
docker compose -f docker-compose.test.yml ps
php -d output_buffering=Off artisan test tests/Feature/Learning/LearningMarketplaceTest.php --testdox
php -d output_buffering=Off artisan test tests/Feature/Learning/LmsAiGenerationTest.php --testdox
php -d output_buffering=Off artisan test tests/Feature/Academy --testdox
php -d output_buffering=Off artisan test tests/Feature/Academy/AcademyFeatureTest.php --testdox
```

PHPUnit DB: Docker `wtc_postgres_test` `127.0.0.1:5433` (`db_cws_test` / `db_lms_test` / `db_academy_test`).

No `migrate:fresh` on product databases. No production migrate.

### Test counts

`LearningMarketplaceTest`: **37** tests (prior 36 + `test_random_pool_twenty_ten_attempt_matrix`).

| Run | Result |
|-----|--------|
| Full class `--testdox` (blocker-close) | **37 passed (158 assertions), 713.93s, OK** |
| Full class `--debug --testdox` (diagnosis) | 36 passed, 1 failed (matrix weighting; then fixed) |
| Prior killed full-class runs | No PHPUnit result (buffered + per-test satellite DDL) |

Academy this pass:

| Suite | Result |
|-------|--------|
| `AcademyAiContentTest` | Prior 31 passed, 1 skipped. This pass spot-check: `test_admin_can_create_generation_request` **PASS** (1 test, 3 assertions) |
| `AcademyFeatureTest` | **14 passed** after restoring `grant_required` 403 on course show (catalog Buy Now still uses `assertLearner`). One isolated first-test `40P01` deadlock was retried after the wipe guard |
| `AcademyStaffAccessTest` | 3 passed |

LMS this pass:

| Suite | Result |
|-------|--------|
| `LmsAiGenerationTest` | **10 passed (112 assertions), 268.93s** — generate-course is no longer a stub; mocked `db_lms` draft import |
| LMS catalog / Exam Master freeze | Covered in `LearningMarketplaceTest` |

### Real vs mocked providers

| Provider | PHPUnit | This machine live smoke |
|----------|---------|-------------------------|
| OpenAI | Fake driver / empty key / stray HTTP forbidden | **NOT CONFIGURED** |
| Manus | Disabled, timeout 0, empty key | **NOT CONFIGURED** (`MANUS REAL-PROVIDER SMOKE PENDING`) |
| Stripe | `FakeStripePlatformClient` | **NOT CONFIGURED** |

### Routes / UI

Browser end-to-end click-through was **not** completed.

### Real Stripe / Manus / OpenAI / migrations / production

| Item | Status |
|------|--------|
| Real Stripe | **NOT CONFIGURED** / **MOCK-VERIFIED ONLY — STAGING REAL STRIPE TEST REQUIRED** |
| Real Manus | **NOT CONFIGURED** |
| Real OpenAI | **NOT CONFIGURED** |
| Product migrations | Additive files exist; **not applied to production** |
| Production | **Not deployed** |

---

## 17. Release decision

### Blockers that remain

1. No non-production `OPENAI_API_KEY` — IRB Evidence Pack → small course smoke not run.
2. `MANUS REAL-PROVIDER SMOKE PENDING`.
3. No Stripe **test-mode** Checkout + webhook (`STRIPE TEST-MODE END-TO-END PASSED` not recorded).
4. Manual Evidence Pack / lesson / MCQ audits have no live artifact.
5. Random-pool **browser** matrix not executed (engine matrix passed).
6. Client LMS `citizenship_exam_prep` **live** AI smoke not executed (mocked factory **PASS**; do not mark `CITIZENSHIP AI SMOKE: PASS`).

Closed this pass: Client LMS `generate-course` stub replaced with `lms_ai_generation_jobs` + `LmsAiDraftImporter`; `LmsAiGenerationTest` 10/112; citizenship profile isolated from RCIC catalog. Credentialed smokes: **not run** (keys unset). Operator steps: `STAGING-VALIDATION-CHECKLIST.md`.

Until staging smokes pass, this is not production-ready and should not be treated as a finished Phase 1–9 release.

### Gate

* Full LearningMarketplaceTest: **PASS**
* LMS AI factory (`LmsAiGenerationTest`): **PASS** (mocked)
* Academy regressions: **PASS** (spot-check this pass; prior full class PASS)
* LMS regressions: **PASS**
* OpenAI real-provider smoke: **NOT CONFIGURED**
* Manus real-provider smoke: **NOT CONFIGURED**
* RCIC Evidence → Course smoke: **FAIL**
* Manual Evidence audit: **FAIL**
* Manual Lesson audit: **FAIL**
* Manual MCQ audit: **FAIL**
* Random mock browser matrix: **FAIL** (engine 20/10 A/B/C PHPUnit remains PASS)
* Stripe test-mode E2E: **NOT CONFIGURED**
* Citizenship AI smoke: **FAIL**

Operator runbook (no secrets): `docs/plans/shared-learning-marketplace/STAGING-VALIDATION-CHECKLIST.md`.

NOT READY — BLOCKERS REMAIN
