# Credentialed staging validation checklist

**Date:** 2026-09-14  
**Companion:** `RELEASE-READINESS.md` · `VERIFICATION.md`  
**Verdict until every PASS mark below is earned:** `NOT READY — BLOCKERS REMAIN`  
**Production deploy:** unauthorized.  
**Product `migrate:fresh`:** forbidden on `db_cws` / `db_lms` / `db_academy`.  
**Frozen RCIC case-handling:** tag `rc-case-handling-phase-0-6` — do not modify.

This is the remaining release gate. PHPUnit is already green offline. These steps require **non-production credentials** and a human operator. Do not commit keys. Do not paste keys into git, chat, or this file.

Closed and **not** re-opened:

| Item | Result |
|------|--------|
| `LearningMarketplaceTest` | PASS — 37 tests, 158 assertions, 713.93s |
| Offline HTTP | Enforced (`Http::preventStrayRequests`, fake OpenAI/Manus/Stripe in PHPUnit) |
| Academy regressions | PASS |
| LMS regressions | PASS |

---

## 0. Environment (do this first)

Use **local** or a dedicated **staging** stack only. Do not use production Stripe live keys, production OpenAI spend budgets intended for live traffic, or production Manus keys on `admin.rcicmaster.ca` unless that host is confirmed non-prod.

### 0.1 Drivers must not be fake

PHPUnit forces `ACADEMY_AI_RESEARCH_DRIVER=fake` and `ACADEMY_AI_GENERATION_DRIVER=fake`. Staging/local `.env` (gitignored) must be:

```
ACADEMY_AI_ENABLED=true
ACADEMY_AI_RESEARCH_DRIVER=auto
ACADEMY_AI_GENERATION_DRIVER=auto
ACADEMY_MANUS_ENABLED=false
ACADEMY_MANUS_FALLBACK=openai
```

Queue: `RunAcademyAiGenerationJob` / `RunLmsAiGenerationJob` are queued (`timeout` 7200s). Either run `php artisan queue:work` or temporarily use `QUEUE_CONNECTION=sync` (HTTP may time out).

Additive migrate only if staging schema is behind:

```bash
cd backend
php artisan migrate --force
```

Never `migrate:fresh` on product databases.

### 0.2 Where to put keys (pick one, never both in git)

Preferred: Admin → [Integrations](https://admin.rcicmaster.ca/admindashboard/integrations) **only if that host is the staging Admin**. Local equivalent: `/admindashboard/integrations`.

| Provider | Admin tab | Env fallback (gitignored `.env` only) |
|----------|-----------|----------------------------------------|
| OpenAI | **OpenAI** → `api_key` | `OPENAI_API_KEY` or `ACADEMY_OPENAI_API_KEY` |
| Manus (optional) | **Manus (Academy research)** → enable + `api_key` | `ACADEMY_MANUS_ENABLED=true` + `MANUS_API_KEY` |
| Stripe TEST | Admin → Payment gateway → Stripe **test** mode | `sk_test_…` / `pk_test_…` / `whsec_…` in gateway settings |

Confirm keys start with `sk_test_` / `pk_test_` for Stripe. Reject `sk_live_`.

After save: **Test** buttons on Integrations / Payment gateway. Do not log the raw key.

### 0.3 Record IDs here (no secrets)

| Artifact | ID / URL (fill in during the run) |
|----------|-----------------------------------|
| Staging host | |
| Exam Master id | |
| Evidence Pack id | |
| AI job id | |
| Draft course id | |
| Mock template id | |
| Attempt A / B / C ids | |
| Stripe Checkout session id | |
| Stripe webhook event id | |
| Citizenship LMS exam id | |

---

## Blocker 1 — OpenAI Evidence → Course golden path

**Mark `OPENAI REAL-PROVIDER SMOKE: PASS` only if a real OpenAI Responses call completes this flow.** Fake/PHPUnit does not count.

### UI / API

Admin: `/admindashboard/learning/exams` · domain **RCIC Academy**.

| Step | Action | Expect |
|------|--------|--------|
| 1 | Create or open **RCIC-IRB Specialization Exam** (`generation_profile=rcic_exam_prep`) | Exam Master row on `db_academy` (`academy_exams`) |
| 2 | Add **3–5 verified official sources** (not blogs). Suggested hosts from `config/learning.php`: `college-ic.ca`, `irb-cisr.gc.ca`, `laws-lois.justice.gc.ca`, `canada.ca` | `is_official=true`, `verification_status=verified` |
| 3 | Verify / snapshot each source | Hash stored; full file only if reuse allowed |
| 4 | OpenAI independent cross-check (job research step and/or `POST .../research`) | `openai_verification_json` stored **separately** from Manus notes |
| 5 | Approve Evidence Pack | `POST /api/v1/admin/learning/exams/{id}/evidence-pack/approve?product_domain=rcic_academy` |
| 6 | Generate **small** course (not a 190-question bank) | `POST .../generate-course` with `independent_count: 10`, `case_based_count: 10`, `case_count: 2`, `generate_lessons: true`. Admin **Generate Full Course with AI** now sends this payload. |
| 7 | Worker runs → status `blueprint` | Human must approve; job must **stop** until approve |
| 8 | `POST /api/v1/admin/academy/ai/jobs/{job}/approve-blueprint` | Generation continues |
| 9 | Draft import | 1 module, 2 lessons, 10 independent MCQs, 2 cases, 10 case-based MCQs, small mock pool, 1 `random_pool` mock — all **draft** |
| 10 | Eight-pass flags + coverage report on the job | Record flags; do not hide validator disagreements |
| 11 | Confirm AI cannot publish | `POST .../jobs/{job}/publish` denied |

Also confirm: agreement between models **without** an official source is **not** `verified`.

Copy usage/token totals from `academy_ai_usage_records` (no API keys).

**This environment (2026-09-14 local `127.0.0.1:5432`, not production):** Admin Integrations OpenAI key present. Chat Completions ping **200**. Small live IRB job `academy_ai_generation_jobs.id=1` reached `draft_ready` with `generation_provider=openai` / `research_provider=openai` (8 draft lessons, 1 imported MCQ, 1 likely_duplicate; citations flagged unverified). **Did not** run the checklist 10/10/2 bank. **Do not mark `OPENAI REAL-PROVIDER SMOKE: PASS`.**

---

## Blocker 2 — Manus real provider (optional)

If no non-production Manus key: keep **`MANUS REAL-PROVIDER SMOKE PENDING`**. Do **not** block OpenAI-only generation.

If a key is available:

1. Enable Manus in Admin Integrations (or `ACADEMY_MANUS_ENABLED=true`).
2. Confirm client is **official v2 only**: `https://api.manus.ai` + `/v2/task.create`, `/v2/task.detail`, `/v2/task.listMessages` (`ManusV2Client`). No unofficial scrape APIs.
3. Run Exam Evidence research on the same IRB exam (job research step with `research_driver=auto` or `manus`).
4. Confirm:

| Check | Pass? |
|-------|-------|
| Task created (`task_id`) | |
| Research completes (`stopped`) | |
| Structured result parsed into research notes | |
| URLs are **candidates** only | |
| Allow-list still applied (`config/academy_ai.php` + `config/learning.php`) | |
| Snapshots verified separately from Manus notes | |
| Exam Master name/structure **unchanged** by Manus JSON | |
| Manus cannot publish | |

Webhook (optional): `POST /api/v1/webhooks/manus/academy-research`.

**This environment:** Manus unset → **`MANUS REAL-PROVIDER SMOKE PENDING`**.

---

## Blocker 3 — Manual Evidence / Lesson / MCQ audit

Use the **real** generated IRB smoke from Blocker 1. If Blocker 1 is NOT CONFIGURED, these stay **FAIL** (no artifact).

Fill the tables in `RELEASE-READINESS.md` (copy rows as needed). Do not hide fails. Record fail rate = failed items / inspected items.

### 3.1 Evidence Pack

| Check | PASS / FAIL | Notes |
|-------|-------------|-------|
| Official authority correct (e.g. CICC / IRB) | | |
| URLs are official hosts | | |
| Structure current | | |
| Duration supported by a verified source | | |
| Question counts supported | | |
| Syllabus / competency evidence valid | | |
| No blog marked authoritative | | |
| Conflicts resolved correctly (or pack blocked) | | |
| Hashes / verification state honest | | |

### 3.2 Lessons (every important claim in both lessons)

| Lesson | Claim | supported | unsupported | citation correct | citation mismatch | correction required |
|--------|-------|-----------|-------------|------------------|-------------------|---------------------|
| 1 | | | | | | |
| 2 | | | | | | |

### 3.3 MCQs (all 20 smoke questions)

| Q id | Exactly one defensible answer | Validator agrees | Ambiguous | Citation supports | Exam relevant | Difficulty OK | Style aligned | Near-copy of official sample | Result |
|------|-------------------------------|------------------|-----------|-------------------|---------------|---------------|---------------|------------------------------|--------|
| | | | | | | | | | PASS/FAIL |

---

## Blocker 4 — Browser mock matrix

Engine 20/10 A/B/C already **PASS** in PHPUnit. Mark **`RANDOM MOCK BROWSER MATRIX: PASS`** only after this manual pass.

Prep (Admin CMS, published **drafts you reviewed**, not auto-publish of un-audited AI):

- ≥ 20 `mock_eligible` published independent MCQs on the exam
- Template: `selection_mode=random_pool`, `total_questions=10`, `independent_count=10`, published

Player: Consultant `/dashboard/academy/exams`  
APIs: `POST /api/v1/consultant/academy/exams/{template}/attempts`, `GET .../attempts/{id}`, `PUT .../answers`, `POST .../submit`

| Check | A | B | C | Pass? |
|-------|---|---|---|-------|
| Sets differ where pool allows | | | | |
| Refresh: exact same question ids | | | | |
| Refresh: exact same option order | | | | |
| Close tab / reopen: same attempt id | | | | |
| Countdown does not reset | | | | |
| Changing OS clock does not extend `expires_at` | | | | |
| No `correct_option_id` / explanations while in progress | | | | |
| Flag state preserved | | | | |
| Navigator answered / unanswered correct | | | | |
| Submit summary correct | | | | |
| Duplicate submit 422 / safe | | | | |
| Expiry auto-submit (`time_expired`) | | | | |
| Result dashboard matches server fields | | | | |

**This environment:** not click-tested → **FAIL**.

---

## Blocker 5 — Stripe TEST MODE E2E

**Mark `STRIPE TEST-MODE E2E: PASS` only after a real Stripe test-mode webhook unlocks access.** Fake fulfillment PHPUnit does not count.

1. Admin → `/admindashboard/payment-gateway` → Stripe **test** keys + webhook secret.  
2. Forward webhooks: `stripe listen --forward-to https://<staging>/api/v1/webhooks/stripe` (or staging dashboard webhook URL).  
3. Publish a **purchase** Academy course (`access_tier=purchase`, `commerce_confirmed`, `price_cents`, `access_months` empty → default **3**).  
4. Consultant: `/dashboard/academy/courses` → Buy Now → `POST /api/v1/learning/checkout` `{ product_domain: "rcic_academy", course_id }`.  
5. Pay with Stripe test card `4242…`.  
6. Hit success URL **without** waiting for webhook first (or block webhook once): confirm **no** entitlement.  
7. Deliver `checkout.session.completed`: row in `learning_course_payments`, `AcademyEntitlement` active, `entitled_until` ≈ now + 3 months **from server**.  
8. Replay same event id → idempotent.  
9. Metadata `product_domain` wrong / Course B id → fail closed; Course A does not unlock B.  
10. `consultant_subscriptions` count **unchanged**.  
11. Client LMS purchase (if run) does **not** create Academy entitlement.  
12. Failed card; refund `charge.refunded` → grant inactive; progress/history rows remain.

**This environment:** Stripe gateway row is `mode=test` but **secret and publishable keys empty**. Checkout/webhook E2E **not run**. **NOT CONFIGURED**. Do not write `STRIPE TEST-MODE E2E: PASS`.

---

## Blocker 6 — Citizenship AI smoke

**Mark `CITIZENSHIP AI SMOKE: PASS` only after a real-provider run that writes drafts to `db_lms`.**

Admin Exams → **Client LMS** → create **Canadian Citizenship Test** (`generation_profile=citizenship_exam_prep`).

| Check | Pass? |
|-------|-------|
| Official hosts only: `canada.ca`, `www.canada.ca`, `ircc.canada.ca` | |
| RCIC/IRB prompt catalog **not** loaded | |
| Evidence Pack on LMS exam | |
| 1 module, 2 lessons, small MCQ bank, 1 random mock — **draft** | |
| Writes only `db_lms` (zero new `db_academy` content rows for this job) | |
| Content review required | |
| Language review if French | |
| CICC legal-review gate **not** required | |
| AI cannot publish | |

Code path (mocked PHPUnit **PASS**, not a live smoke): `POST /api/v1/admin/learning/exams/{id}/generate-course?product_domain=client_lms` persists `lms_ai_generation_jobs`, pauses for human blueprint approval (`POST /api/v1/admin/learning/lms-ai-jobs/{id}/approve-blueprint`), then `LmsAiDraftImporter` writes draft `db_lms` rows. Do **not** mark `CITIZENSHIP AI SMOKE: PASS` from that PHPUnit class.

**This environment:** small live citizenship job `lms_ai_generation_jobs.id=1` on local `db_lms` reached `draft_ready` (`openai` research+generation): 1 module, 2 lessons, 2 draft MCQs, course-question pivots, `random_pool` template, `review_status=content_review`, `is_published=false`, Academy course count unchanged. Checklist 10-MCQ bank **not** run. **Do not mark `CITIZENSHIP AI SMOKE: PASS`.**

Suggested SQL (staging, after a run):

```sql
-- academy: count should be unchanged for citizenship job
-- lms: new exam / pack / items for the citizenship exam id
```

---

## Sign-off rules

| Mark | Allowed when |
|------|----------------|
| `OPENAI REAL-PROVIDER SMOKE: PASS` | Real OpenAI call + draft import of the small IRB course |
| `MANUS REAL-PROVIDER SMOKE PENDING` | No key (optional provider) |
| `RANDOM MOCK BROWSER MATRIX: PASS` | Manual browser table complete |
| `STRIPE TEST-MODE E2E: PASS` | Real test-mode webhook unlock |
| `CITIZENSHIP AI SMOKE: PASS` | Real provider + `db_lms` drafts + isolation checks |
| `READY FOR STAGING` | Every required row in `RELEASE-READINESS.md` §17 is PASS (Manus may remain PENDING/NOT CONFIGURED) |
| `READY FOR PRODUCTION` | **Do not output** from this checklist |

Copy the filled gate table into `RELEASE-READINESS.md` after the run. No secrets in that commit.
