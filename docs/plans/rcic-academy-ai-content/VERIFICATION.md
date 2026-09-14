# RCIC Academy — AI Content Studio / AI Course Factory — verification

**Date:** 2026-09-14  
**Scope:** Phases 1–9 as locked in `PLAN.md` (R1–R20 with R3 replaced; O1–O15 with O2 and O12 replaced).  
**Production:** not deployed. Do not deploy from this work. Frozen tag `rc-case-handling-phase-0-6` is unchanged. No `migrate:fresh` on product `db_cws` / `db_lms` / `db_academy`.

AI Content Studio generates **drafts only**. Existing `AcademyWorkflow` (`draft → content_review → legal_review → approved → published → archived`) remains authoritative. Neither OpenAI nor Manus can publish or approve.

---

## How to apply locally (not production)

```bash
cd backend
php artisan migrate
```

New migration (additive, `academy` connection only):

- `2026_09_14_160000_create_academy_ai_tables.php`

Existing Academy Phases 1–9 tables stay in place. Provenance columns (`generated_by_ai`, `ai_generation_job_id`, `ai_prompt_version`) are added as nullable defaults on course/question/case versions and lessons.

Required env (see `backend/.env.example`):

| Variable | Default / notes |
|----------|-----------------|
| `ACADEMY_AI_ENABLED` | `true` |
| `ACADEMY_OPENAI_API_KEY` | optional override; else shared `OPENAI_API_KEY` |
| `ACADEMY_AI_REASONING_MODEL` | config-driven |
| `ACADEMY_AI_FAST_MODEL` | config-driven |
| `ACADEMY_AI_VALIDATION_MODEL` | defaults to reasoning model |
| `ACADEMY_AI_IMAGE_MODEL` | config-driven |
| `ACADEMY_AI_MONTHLY_BUDGET_USD` | hard-block when exceeded |
| `ACADEMY_AI_BATCH_SIZE` | `10` |
| `ACADEMY_MANUS_ENABLED` | `false` |
| `MANUS_API_KEY` | empty unless Manus research is activated |
| `ACADEMY_MANUS_FALLBACK` | `openai` |
| `ACADEMY_MANUS_WEBHOOK_URL` | public URL used for signature verification |

PHPUnit forces `ACADEMY_AI_RESEARCH_DRIVER=fake` and `ACADEMY_AI_GENERATION_DRIVER=fake`.

---

## Locked provider architecture (verified in code)

| Role | Implementation |
|------|----------------|
| Research | `AcademyResearchProvider` → Manus (optional official API v2) or OpenAI Responses |
| Generation / validation / images | `AcademyGenerationProvider` → OpenAI Responses + `/v1/images/generations` |
| Orchestrator | `AcademyAiOrchestrator` |

Official Manus API v2 endpoints used (no invented paths):

- `POST https://api.manus.ai/v2/task.create`
- `GET https://api.manus.ai/v2/task.detail`
- `GET https://api.manus.ai/v2/task.listMessages`
- `GET https://api.manus.ai/v2/webhook.publicKey`

Webhook verification matches [Manus API v2 Webhook Security](https://open.manus.ai/docs/v2/webhooks-security): `{timestamp}.{url}.{sha256_hex(body)}`, RSA-SHA256, 5-minute replay window.

Academy OpenAI uses **Responses** (`POST /v1/responses`) with `text.format` strict JSON Schema. Maple / Legislation / Letters Chat Completions call sites were **not** migrated.

---

## Pipeline

Admin generation request → source pack → research (Manus if enabled+configured, else OpenAI) → allow-list / snapshot → OpenAI structured generation → **blueprint gate** (course jobs) → lessons / MCQs / cases → five-pass validation (Pass 3 never sees generated `is_correct`) → optional images → **draft import** → human `content_review` → legal review → approved → published.

Manus output is `ResearchNotes` only. Discovery ≠ approval. Candidate URLs that fail the allow-list are stored as non-authoritative snapshots.

---

## Admin UI

- Route: `/admindashboard/academy/ai-studio`
- Nav: RCIC Academy → AI Content Studio
- APIs: `/api/v1/admin/academy/ai/*` (`role:super-admin,admin`)
- Manus webhook: `POST /api/v1/webhooks/manus/academy-research` (signature required)

There is no Generate & Publish action. `POST .../jobs/{job}/publish` always returns 422.

---

## Tests

| Suite | Result |
|-------|--------|
| `AcademyAiContentTest` | **32 tests, 124 assertions, 1 skipped** |
| Existing Academy Phases 1–9 + staff, case journey, subscription hardening, referral/wallet, team/staff | **70 tests, 520 assertions, OK** |
| Consultant Vitest (`academy-nav`, `team-access`) | **4 passed** |

Covered including addendum tests 42–53:

- Admin create / non-admin blocked
- Provider split; Manus disabled → fake/OpenAI-only
- Structured schemas; invalid JSON retry then item-fail
- Source pack + immutable snapshots
- Blueprint edit/approve gate; lessons/MCQs/cases as `draft`
- Citation unverified / validator disagreement / ambiguity flags
- AI cannot publish; legal-review path still required
- Regenerate one question; historical attempt `question_version_id` intact
- Duplicate detection; retry does not duplicate; cancel
- 429 typed as `AcademyAiRateLimited`; usage recorded; keys absent from JSON
- Images metadata; image failure leaves text
- Mock pool counts + difficulty mix
- Mocked Manus v2 `task.create` / structured output parse
- Manus URL does not bypass allow-list
- Manus failure + `fallback=fail` marks job `failed`
- Research notes cannot insert questions
- OpenAI Responses `text.format.json_schema.strict`
- Prompt-injection source text wrapped as untrusted
- Independent validator prompt has no `is_correct` / generated explanation
- Budget hard-block

PHPUnit uses `db_academy_test` only. Helpers refuse to wipe any other Academy database.

---

## Regressions (this verification pass)

| Suite | Result |
|-------|--------|
| Academy Phases 1–9 + staff (`AcademyFeatureTest`, `AcademyStaffAccessTest`) | included in the 70-test OK run above |
| `CaseFullJourneyReleaseTest` | included in the 70-test OK run |
| `SubscriptionBillingHardeningTest` | included in the 70-test OK run |
| `ReferralWalletTest` | included in the 70-test OK run |
| `TeamStaffAccessTest` | included in the 70-test OK run |

Skipped in the AI suite: `test_manus_webhook_signature_and_idempotency` — OpenSSL RSA key generation is unavailable on this Windows PHP build. `ManusWebhookVerifier` still implements official v2 signed-content format. Re-run that test where `openssl_pkey_new` works.

No client LMS, Stripe, Maple prompt, exam-engine, entitlement, or Phase 0–6 behavior was intentionally changed except:

- Academy CMS migration early-return now bootstraps only when `academy_exam_templates` already exists (avoids a crash on incomplete test schemas). Complete production schemas still bootstrap as before.

---

## Remaining limitations

- Manus is optional and off by default. Activating it requires `ACADEMY_MANUS_ENABLED=true` and `MANUS_API_KEY`.
- Manus does not generate courses/questions/images and is never authoritative law.
- Exact Manus dollar cost is not fabricated when the API omits it.
- Lesson images remain off unless the admin checks Generate images.
- Exam engine still samples published questions by type counts only (R17 / O9).
- Webhook signature test skipped on this Windows OpenSSL configuration.
- No production deploy from this work.

---

## Confirmation

- No production deployment was performed.
- `migrate:fresh` was not run against product `db_cws`, `db_lms`, or `db_academy`.
- AI-generated Academy rows are created as `draft`.
