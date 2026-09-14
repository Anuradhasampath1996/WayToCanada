# RCIC Academy — AI Content Studio / AI Course Factory

**Status:** approved — implement Phase 1 → 9.  
**Date:** 2026-09-14 (locked 2026-09-14)  
**Depends on:** RCIC Academy Phases 1–9 (`docs/plans/rcic-academy/PLAN.md`, `VERIFICATION.md`)  
**Working name:** AI Content Studio  
**Admin entry:** Admin → RCIC Academy → AI Content Studio  

**Out of scope until a later approved plan:** production deploy, `migrate:fresh`, changing Academy exam-engine scoring/timer/key-stripping, changing Academy entitlement, changing published-version pin semantics, client LMS, RCIC case-handling Phase 0–6 or tag `rc-case-handling-phase-0-6`, Stripe fulfillment, referral/wallet, team/staff ACL (except if a later instructor role is approved), Maple production prompts/boundaries, Manus generation/publication (research-only), AI Tutor for learners, CICC-approved marketing claims, “100% AI accuracy” claims.

R1–R20 and O1–O15 are **locked** (R3, O2, and O12 replaced as approved). Implement Phase 1 → 9. After implementation: create `docs/plans/rcic-academy-ai-content/VERIFICATION.md`.

---

## Implementation gate

1. Approve or rewrite the **Recommended locked decisions** and **Open decisions** below.
2. Then implement Phase 0 → 9 in order.
3. No production deploy from this plan.
4. No `migrate:fresh` on product/production `db_cws`, `db_lms`, or `db_academy`.
5. Do not modify Phase 0–6 case-handling or the frozen tag `rc-case-handling-phase-0-6`.
6. Do not change RCIC Academy Phases 1–9 behavior except **additive** integration (new tables, new admin APIs/UI, provenance metadata, draft import into existing CMS services).
7. Do not merge generated content into the client LMS.
8. AI must **never** publish Academy content. Existing `AcademyWorkflow` remains authoritative.

Phase 1 may proceed. Do not deploy. Do not `migrate:fresh` product databases.

---

## Product goal

An administrator can open **AI Content Studio** and generate a complete **draft** exam-prep course (and/or question/case/mock pools) from a learning track, using a **source-first**, staged, queued pipeline.

Example target (IRB specialization is one track, not the engine):

- syllabus / course blueprint
- modules and lessons
- independent MCQs
- reusable case scenarios + case-based MCQs
- explanations and citations
- thumbnails / lesson images
- a reviewed mock-exam **question pool** larger than a single sitting

All generated Academy rows enter the existing workflow:

`draft → content_review → legal_review → approved → published → archived`

“AI Generated” is a **generation-job / provenance** state, not a new publishable Academy content status. Generated course/question/case **versions** are created as `draft`.

The product must reduce risk. It must **not** claim official CICC questions, official pass prediction, legal advice, or 100% AI accuracy.

---

## 0. Current architecture findings (inspection)

### 0.1 RCIC Academy (do not rewrite)

| Item | Finding |
|------|---------|
| Database | Separate Postgres `db_academy`, Laravel connection `academy`. Models extend `AcademyModel`. |
| CMS | `AdminAcademyController` + `/api/v1/admin/academy/*` behind `auth:sanctum` + `role:super-admin,admin`. |
| Learner APIs | `/api/v1/consultant/academy/*` via `AcademyAccess` (rcic / staff+`academy.learn`; clients 404). |
| Workflow | `AcademyWorkflow::STATUSES` = draft, content_review, legal_review, approved, published, archived. Publish from non-approved requires override + `academy_content_reviews` audit (`[admin override]`). |
| Versioning | Courses, questions, cases have version rows. Attempts store `question_version_id`. Learners pin `course_version_id`. |
| Questions | `independent_mcq` / `case_mcq`. One `is_correct` option. Version has `explanation`; options have `incorrect_explanation`. Topics/competencies on the **version**. |
| Cases | Reusable `academy_cases` + `academy_case_versions` + exhibits; questions attach via `case_version_id` / `academy_case_questions`. No silent case-text duplication required. |
| Exam engine | `AcademyExamService` samples **published** questions by template `independent_count` / `case_based_count`. IRB `190 / 240 / 95+95` is **seeded template only**. `topic_mix_json` / `difficulty_mix_json` columns exist but the engine does **not** yet enforce them. |
| Sources | `academy_legal_sources` (title, org, URL, type, citation_label, effective_date, last_verified_at, version_label, status, summary, optional `legislation_document_id` deep-link to CWS Legislation Hub). Links in `academy_content_source_links`. Citations revealed after score only. |
| Outdated | Human queue (`AcademyOutdatedService`). Academy v1 explicitly forbade AI rewrite of outdated law. |
| Media | `ACADEMY_MEDIA_DISK` / disk `academy` (`storage/app/private/academy`). Lesson upload `POST .../lessons/{lesson}/media`. Course `thumbnail_url` is a URL string today. |
| Provenance | Author/reviewer/approver timestamps exist. **No** `generated_by_ai`, model, prompt version, or job id on Academy rows. |
| Admin UI | JSON workbench at `frontend/Admins Dashbord/.../admindashboard/academy/page.tsx`. Tabs: dashboard, courses, Question Bank, cases, exam-templates, topics, competencies, sources, reports, outdated, analytics. **No AI studio.** |
| Notifications | Admin in-app for reports, legal review pending, outdated sources. |

**Do not change:** exam scoring, server timer, in-progress key stripping, entitlement matrix, pin/switch-latest semantics, client 404, `lms.view` meaning.

### 0.2 OpenAI in this repo (reusable credentials, not reusable pipeline)

There is **no** shared `AiProvider` / OpenAI client class.

| Item | Finding |
|------|---------|
| Key | `OPENAI_API_KEY` → `config('services.openai.key')`. Admin → Integrations → OpenAI stores encrypted payload on `cws.integration_settings`. Runtime merge: env then DB (`IntegrationSettingsService::applyOpenAi`). Middleware `ApplyIntegrationSettings`. |
| HTTP API used | **Only** `POST https://api.openai.com/v1/chat/completions`. **No** `/v1/responses`. **No** `/v1/images/generations` in backend. |
| Structured output | Several services use `response_format: json_object` and parse message content. None use JSON Schema structured outputs. |
| Models | Defaults are `gpt-4o-mini` in legislation, workspace, letters, OCR. Hardcoded in call sites. No Academy AI config yet. |
| Test | `POST /api/v1/admin/integration-settings/openai/test` — tiny chat completion; rejects `sk-test` placeholders. |
| Call sites (do not hijack) | Legislation analyze/linkify/search/explain, Maple workspace chat/analyze, letters, retainer drafts, OCR Vision, NOC suggest, IRCC package tie-break. |

**Reuse for Academy AI:** the existing **key + Integrations UI**, not Maple prompts, not legislation linkify prompts, not free-form chat.

**Academy AI client (new):** dedicated wrapper with configurable models, timeouts, JSON Schema structured output, usage logging, and **no API keys in responses**.

### 0.3 Maple (do not reuse as the course factory)

Maple is the **product name** of the consultant workspace / legislation assistant (`WorkspaceAiCharacter::NAME = 'Maple'`), not a third-party vendor.

- Orchestrator: `WorkspaceAiAdvisorService` (OpenAI chat/analyze or rules fallback).
- Boundaries: `MapleAiBoundaries` forbids pathway selection, document approval, signing, **IRCC submission**, final eligibility decisions.
- Maple is **decision support only**. It does not auto-submit to IRCC.

**Do not** generate Academy exam-prep courses through Maple chat.  
**Do not** change Maple production prompts or `MapleAiBoundaries` in this plan.  
**Do not** show Maple branding on AI Content Studio (this is an admin authoring tool).

Reusable *patterns* only: `json_object` parsing lessons, timeout/fallback, “AI used” flags for audit — implemented in a **new** Academy namespace.

### 0.4 Manus (official API v2; optional research-only)

Repo inspection still finds **no** existing Manus client, env key, or adapter. Official **API v2** is documented at [open.manus.ai/docs/v2](https://open.manus.ai/docs/v2/introduction). **Do not use deprecated API v1.** **Do not invent endpoints.**

Documented v2 facts used by this plan (retrieved 2026-09-14):

| Item | Official value |
|------|----------------|
| Base URL | `https://api.manus.ai` |
| Auth | `x-manus-api-key: $MANUS_API_KEY` (or OAuth `Authorization: Bearer`; Academy uses API key) |
| Create research task | `POST /v2/task.create` |
| Task status | `GET /v2/task.detail?task_id=` |
| Poll messages / structured result | `GET /v2/task.listMessages?task_id=&order=desc&limit=` |
| Structured output | `structured_output_schema` on `task.create` (strict JSON Schema subset: all properties required, `additionalProperties: false`) |
| Optional webhook register | `POST /v2/webhook.create` |
| Webhook public key | `GET /v2/webhook.publicKey` (API key only) |
| Webhook headers | `X-Webhook-Signature` (Base64 RSA-SHA256), `X-Webhook-Timestamp` (unix seconds) |
| Signed content | `{timestamp}.{full_url}.{sha256_hex(raw_body)}` |
| Replay window | reject if timestamp older than **5 minutes** |
| Agent profiles | `standard` (default), `lite`, `max` |
| Task statuses | `running`, `stopped`, `waiting`, `error` |

v1 implements `ManusAcademyResearchProvider` as an **optional** research adapter. Default: `ACADEMY_MANUS_ENABLED=false`. OpenAI-only research/generation must work when Manus is off or unconfigured. Manus returns `ResearchNotes` only — never courses, lessons, questions, cases, citations, legal sources, or published rows.

### 0.5 Queue / jobs

| Item | Finding |
|------|---------|
| Default | `QUEUE_CONNECTION=database` (`.env.example`, deploy). PHPUnit / CI: `sync`. |
| Existing `ShouldQueue` jobs | `RunLegislationSyncJob` (timeout 7200), `SyncLegislationCatalogBatchJob` (1800), `RunRcicRegisterSyncJob` (28800, unique), `DeliverNotificationChannelsJob`. |
| Pattern | Persist a run row → `Job::dispatch($id)` → worker updates status → admin polls. Warn if driver is `sync` (HTTP may timeout). |
| Failures | `failed_jobs` table; legislation hub already surfaces queue health. |

Academy AI generation **must** use queued jobs. Do not generate a whole course inside one HTTP request.

### 0.6 Client LMS / other products

Client LMS (`db_lms`) is IELTS/CELPIP/etc. for immigration clients. **Do not** write Academy AI rows there.  
Case-handling, Stripe, referral/wallet, team/staff remain untouched except additive admin Academy routes.

---

## 1. Positioning and forbidden claims

AI Content Studio produces **independent study-aid drafts** for RCIC professional exam preparation.

Forbidden in generated learner-facing copy and admin marketing:

- official CICC exam questions / CICC-approved course
- guaranteed pass / official pass prediction
- “100% AI accuracy” or legal-certainty percentages shown to learners
- imagery implying CICC / IRCC / IRB endorsement (seals, fake forms, fake credentials, fake exam screenshots)

Learner-visible confidence scores are **not** allowed. Admins may see coarse labels only (High Confidence / Review Recommended / Source Issue / Answer Conflict).

---

## 2. Provider architecture

Keep research and generation **logically separated**. Do not force every vendor to implement images/generation/research.

```
AcademyResearchProvider
  research(SourcePack, task): ResearchNotes
  configured(): bool

AcademyGenerationProvider
  generateStructured(schema, prompt, context): array
  validateStructured(schema, prompt, context): array
  generateImage(prompt, options): ImageResult
  configured(): bool

AcademyAiOrchestrator
  chooses providers by capability + config
```

Recommended implementations:

- `ManusAcademyResearchProvider implements AcademyResearchProvider`
- `OpenAiAcademyResearchProvider implements AcademyResearchProvider`
- `OpenAiAcademyGenerationProvider implements AcademyGenerationProvider`

### 2.2 OpenAI (primary generation + default research + images)

`OpenAiAcademyGenerationProvider` / `OpenAiAcademyResearchProvider`

- **New Academy provider uses the OpenAI Responses API** (`POST https://api.openai.com/v1/responses`).
- Strict Structured Outputs via `text.format` `{ type: json_schema, name, strict: true, schema }`.
- Images: documented `POST /v1/images/generations` isolated in the same generation provider.
- Do **not** build the Academy client around Chat Completions merely because Maple/Legislation/Letters still use it.
- Do **not** migrate those existing call sites in this work.
- Isolate API version/provider response objects behind the provider. Domain layer sees arrays/DTOs only.
- Models from config only (see §3). Never scatter model IDs through services.
- Record provider, model, prompt version, token usage, estimated cost. If validation uses a different model than generation, **record the switch**.

### 2.3 Manus (optional research-only, official API v2)

`ManusAcademyResearchProvider`

- Enabled only when `ACADEMY_MANUS_ENABLED=true` **and** `MANUS_API_KEY` is set.
- Uses documented v2 only: `task.create`, `task.detail`, `task.listMessages`, webhook verify via `webhook.publicKey`.
- Flow: scoped research instructions + `structured_output_schema` → async task → signed webhook (polling fallback) → `ResearchNotes` → **our** allow-list / retrieval / snapshot pipeline.
- Discovery ≠ approval. A Manus URL is a candidate only.
- Must **not** insert courses, lessons, questions, cases, citations, legal sources, or published content.
- Must **not** publish, legally approve, assert final answer truth, or change `AcademyWorkflow`.
- If Manus fails/times out: fail the research step **or** fall back to OpenAI research per configured policy (`ACADEMY_MANUS_FALLBACK=openai`). Do not duplicate downstream entities.
- Webhooks: verify RSA-SHA256 exactly as official v2 docs; 5-minute replay window; idempotent event ids; never trust unsigned callbacks; never publish from a webhook.
- Cost: record provider + task/request id; do **not** invent a Manus dollar amount if the API does not return one.

Default: Manus disabled → OpenAI-only pipeline.

### 2.4 Failure policy

| Condition | Behavior |
|-----------|----------|
| Manus unavailable / disabled | OpenAI-only path continues |
| OpenAI generation fails | Job → `failed` or `partially_failed`; **no published rows**; drafts already written stay draft |
| Timeout / 429 | Retry with backoff per step; persist error; do not create duplicate entities |
| Provider disabled | 422 on new jobs; in-progress jobs fail safely |
| Image failure | Textual drafts remain; media step marked failed |

---

## 3. Configuration

New `backend/config/academy_ai.php` (names illustrative):

```
ACADEMY_AI_ENABLED=
ACADEMY_AI_PROVIDER=openai
ACADEMY_AI_REASONING_MODEL=
ACADEMY_AI_FAST_MODEL=
ACADEMY_AI_IMAGE_MODEL=
ACADEMY_AI_VALIDATION_MODEL=   # default: reasoning model; if different, audit it
ACADEMY_AI_TIMEOUT_SECONDS=
ACADEMY_AI_MAX_QUESTIONS_PER_JOB=
ACADEMY_AI_MAX_SOURCE_CHARS=
ACADEMY_AI_MONTHLY_BUDGET_USD=
ACADEMY_AI_BUDGET_WARN_PERCENT=
ACADEMY_AI_IMAGE_LIMIT_PER_JOB=
```

Key resolution (recommended):

1. Optional `ACADEMY_OPENAI_API_KEY` if set  
2. Else existing `services.openai.key` (Integrations / `OPENAI_API_KEY`)

Never return keys to the frontend. Admin settings tab shows masked “configured / missing” only.

PHPUnit uses fake/http-fake provider; never live keys in CI.

---

## 4. Staged pipeline (no single-call course)

A generation request creates `academy_ai_generation_jobs` and child `academy_ai_generation_steps`.

```
queued
  → researching          (Source Pack + snapshots)
  → blueprint            (course architecture; wait for admin if job type requires it)
  → generating           (modules → lessons → questions → cases, batched)
  → validating           (passes 1–5)
  → generating_media     (optional)
  → draft_import         (write Academy draft versions via existing CMS services)
  → draft_ready | partially_failed | failed | cancelled
```

Rules:

- Each stage is resumable and auditable (input/output refs, status, error, timestamps).
- Admin **Generate Blueprint Only** stops after `blueprint` until **Approve Blueprint → Generate Content**.
- Do not generate hundreds of questions in one model response. Default batch size e.g. 10 (configurable).
- Retry from the failed step. Idempotency keys on `academy_ai_generated_items` prevent duplicate Academy rows.
- Cancel cooperative: worker checks `cancelled` between batches; already-imported drafts remain drafts (not deleted, not published).

---

## 5. Source-first policy

### 5.1 Priority (authoritative legal conclusions)

1. Existing **verified / published** `academy_legal_sources` selected by the admin  
2. Government of Canada / Justice Laws (via approved URL or `legislation_document_id` snapshot)  
3. IRB official materials  
4. CICC official materials  
5. Other admin-approved authoritative sources  
6. Secondary commentary — **explanation/research only**, never the sole support for a legal conclusion  

The model must **not** freely browse the web and treat arbitrary pages as law.

### 5.2 Source pack

`AcademySourcePack` (row + items):

- selected Academy source IDs
- approved URLs (fetched by **our** retrieval service, not model browsing)
- uploaded PDFs/docs (stored on `ACADEMY_MEDIA_DISK`, text extracted)
- optional Legislation Hub document snapshot (`legislation_document_id`)

A job records **exactly** which source versions were used.

### 5.3 Source snapshot

Table `academy_ai_source_snapshots`:

- `generation_job_id`
- `legal_source_id` (nullable)
- `title`, `url`, `organization`
- `version_label` / `effective_date` / `last_verified_at`
- `retrieved_at`
- `content_hash` (sha256 of retrieved text or file)
- `storage_disk` + `storage_path` **or** truncated `excerpt` (size-capped)
- `retrieval_method` (`academy_source`, `url_fetch`, `upload`, `legislation_hub`)

If a citation cannot be tied to a snapshot, do **not** invent one → `citation_unverified`.

### 5.4 Retrieval

New `AcademyAiSourceRetrievalService`:

- Read published/approved Academy sources chosen by admin  
- Fetch allow-listed official hosts only (config allow-list: justice.gc.ca, irb-cisr.gc.ca, canada.ca, college-ic.ca / current CICC host, etc.)  
- Extract text from uploads (reuse OCR/text-layer patterns **without** changing OCR product behavior)  
- Cap characters per source and per job (`ACADEMY_AI_MAX_SOURCE_CHARS`)

---

## 6. Database additions (`db_academy` only)

New migration on connection `academy`. Do not put AI factory rows on `db_lms` or `db_cws` except `users.id` actor references (no FK, same as existing Academy).

Recommended tables:

| Table | Purpose |
|-------|---------|
| `academy_ai_generation_jobs` | Request, type, track/template, status, progress JSON, blueprint JSON, requested_by, timestamps, error |
| `academy_ai_generation_steps` | Stage name, status, attempt, input/output refs, provider, model, started/completed, error |
| `academy_ai_source_packs` | Pack header for a job |
| `academy_ai_source_pack_items` | Selected sources / uploads / URLs |
| `academy_ai_source_snapshots` | Immutable retrieved snapshot |
| `academy_ai_generated_items` | Maps job+idempotency key → Academy entity (`course_version`, `lesson`, `question_version`, `case_version`, `media`) |
| `academy_ai_validation_results` | Per item: pass flags, scores, validator answer, disagreement, labels |
| `academy_ai_usage_records` | Provider, model, prompt_version, tokens, estimated/actual cost, step_id |
| `academy_ai_prompt_runs` | Optional: prompt_key, prompt_version, hash of rendered prompt (not secrets) |
| `academy_ai_media` | Prompt, provider, model, disk/path, generated_at, cost, approval status, content id |
| `academy_ai_settings` | Singleton-ish admin budget/limits (or `config` + one settings row) |

**Do not store API keys.**

### 6.1 Provenance on existing Academy versions (additive columns)

Add nullable metadata **without changing workflow meaning**:

On `academy_course_versions`, `academy_question_versions`, `academy_case_versions` (and lesson row if needed):

- `generated_by_ai` boolean default false  
- `ai_generation_job_id` nullable  
- `ai_prompt_version` nullable string  

Learners do not receive these fields. Admin/audit APIs do.

Existing published/historical rows remain `generated_by_ai = false`.

---

## 7. Prompt versioning

Prompts live in versioned PHP/JSON templates, **not** in migrations.

Examples:

- `course_blueprint:v1`
- `lesson_writer:v1`
- `independent_mcq:v1`
- `case_scenario:v1`
- `case_mcq:v1`
- `citation_mapper:v1`
- `question_validator:v1`
- `ambiguity_check:v1`
- `image_prompt:v1`

Store `prompt_key` + `prompt_version` on steps and generated items. Updating wording increments version; no schema change.

---

## 8. Structured schemas (required)

Each generate/validate call must declare a JSON Schema. Invalid JSON → retry once → fail the batch item, not the whole job (unless the blueprint itself is invalid).

Minimum schemas (fields illustrative):

**Course blueprint:** title, goal, track_key, modules[{title, objective, estimated_hours, topic_keys, lesson_outlines[]}]

**Lesson:** objectives[], overview, key_concepts[], relevant_law[], practical_interpretation, exam_notes, common_mistakes[], worked_example, takeaways[], source_refs[], practice_question_stubs[]

**Independent MCQ:** stem, options[{key, text, is_correct, incorrect_explanation}], explanation, difficulty, topic_keys[], competency_keys[], citations[], source_evidence[], confidence_notes

**Case:** facts, immigration_history, procedural_history, evidence, tribunal_context, legal_issues[], exhibits[]

**Case MCQ:** same as independent + `case_anchor` (not a full case copy)

**Citation map:** claims[] → source_id/snapshot_id + section_label + excerpt + verified bool

**Validation:** structural_ok, grounding_ok, validator_option_key, agrees_with_generated, ambiguous, currency_ok, flags[]

Reject free-form prose as the write path into the database.

---

## 9. Course generator

Admin selects: learning track, optional exam template, title, goal, difficulty, estimated hours, source pack.

1. **Generate Blueprint** → job stops at editable blueprint JSON (shown in UI).  
2. Admin may edit modules/lessons.  
3. **Approve Blueprint & Generate Draft** → remaining stages.  

No **Generate & Publish** button.

Partial: regenerate one module/lesson without rebuilding the course. New lesson/question versions; old versions stay.

Import uses existing `AcademyCourseService::createDraft` / `draftVersionForEdit` / module+lesson creates. Course and version status = `draft`.

---

## 10. Lesson generation

Lessons are generated from the **approved** blueprint, one or a small batch at a time.

Required sections (§8). Do not copy copyrighted third-party commercial courses. Legal quotations only from snapshot-backed sources, consistent with existing source architecture and disclaimer.

Lesson HTML stored in `academy_lessons.body_html`. Practice stubs may become linked draft questions.

---

## 11. MCQ and case generation

### Independent MCQ

Create `academy_questions` + draft `academy_question_versions` + options via `AcademyQuestionService`. Exactly one `is_correct`. Explanations required. Attach topics/competencies by **keys** resolved to existing taxonomy (do not invent topic rows silently; flag unknown keys).

### Cases

Create one `academy_cases` + draft version + exhibits. Then generate N `case_mcq` versions pointing at that `case_version_id`. Do not paste the full case into every question stem.

### Question rules (validator + importer)

- Exactly one defensible correct option  
- No duplicate option text  
- No “all of the above” unless job flag allows  
- Avoid trivially longer correct option (heuristic flag, not auto-rewrite)  
- No unsupported legal assertion  
- No conflicting citations  
- No claim it is an official exam question  
- Realistic professional scenario  

Failed structural import → item stays in `academy_ai_generated_items` as `rejected_import`, not an Academy row.

---

## 12. Multi-pass validation

Run **before** moving an item into the human review queue as “ready for content_review”. Items always remain `draft` until a human transitions them.

| Pass | Check | On fail |
|------|--------|---------|
| 1 Structural | Schema, required fields, option count, exactly one correct | reject import or flag `structural_invalid` |
| 2 Grounding | Answer + explanation supported by selected snapshots; citations present | `citation_unverified` / `source_issue` |
| 3 Independent solve | Separate validation call **without** the generated correct key; compare | `answer_conflict` + `needs_review` |
| 4 Ambiguity | More than one reasonably correct option | `ambiguous` + `needs_review` |
| 5 Currency | Snapshot effective/verified dates stale or source `outdated` | `source_currency` flag |

Scores stored internally: `source_grounding_score`, `answer_consistency_score`, `ambiguity_score`, `citation_coverage_score`.

Admin labels only: High Confidence / Review Recommended / Source Issue / Answer Conflict.

**Validation 100% ≠ publish.** `citation_unverified` or `answer_conflict` **cannot** auto-transition to `approved`.

Optional: set `needs_legal_review` on the question version when flags fire (existing column).

---

## 13. Citation verification

Each legal claim/question should create `academy_content_source_links` to snapshot-backed `academy_legal_sources`.

If the model cannot verify a citation against the pack: **omit** the fake cite, set `citation_unverified`, keep draft.

Do not auto-create published legal sources from random URLs. New source rows, if created, stay `draft` until a human publishes the source.

---

## 14. Images

Optional stage after textual drafts.

Allowed: course thumbnail, module cover, lesson illustration, simple study diagram.

Forbidden: fake government forms, seals, credentials, official exam UI, endorsement imagery.

Store `academy_ai_media` (prompt, provider, model, disk, path, cost, `approval_status`). Write `thumbnail_url` / `media_url` only after **admin media approval**. Unpublished media must not appear on learner APIs.

Image failure does not roll back lessons/questions.

Use `ACADEMY_MEDIA_DISK` (not a hardcoded production disk).

---

## 15. Mock / exam pool generation

Admin picks an exam template (e.g. seeded IRB mock) and requests a **pool**, not a published sitting.

Example request: 300 independent + 300 case-based, with difficulty/topic/competency mix.

Rules:

- Do **not** generate exactly 190 and publish an exam.  
- Do **not** change `AcademyExamService` sampling in this plan (engine still draws from **published** questions by type counts).  
- Generator **must** obey requested counts and mix when creating drafts.  
- Template `topic_mix_json` / `difficulty_mix_json` may be used as **generation hints**. Enforcing mix at **exam sit time** is a later Academy engine change (out of scope unless separately approved).  

---

## 16. Admin UI

New route (recommended): `/admindashboard/academy/ai-studio`  
Nav: child of **RCIC Academy** or tab on the Academy admin page. Label: **AI Content Studio**.

Tabs:

1. Generate Course  
2. Generate Questions  
3. Generate Cases  
4. Generate Mock Pool  
5. Generation Jobs (progress, retry, cancel)  
6. Review Queue (generated draft + source evidence + validator vs generated answer)  
7. AI Settings (provider, models, budgets, enable/disable)  
8. Usage / Cost  

Generate Course fields: track, exam template, title, goal, difficulty, hours, sources (Academy list + URLs + uploads), counts, difficulty mix, checkboxes for lessons/MCQ/cases/images.

Buttons: **Generate Blueprint** then **Approve Blueprint & Generate Draft**. No publish action here. Publishing stays on existing CMS transition APIs.

Review actions: Approve (means “send to `content_review`”, not publish), Edit, Reject, Regenerate, Request Another Validation.

---

## 17. Jobs, progress, retry

Statuses: `queued`, `researching`, `blueprint`, `generating`, `validating`, `generating_media`, `draft_ready`, `partially_failed`, `failed`, `cancelled`.

Progress JSON example: `{ "modules": "5/8", "lessons": "27/42", "questions": "220/500", "validation": "180/220" }`.

Jobs:

- `RunAcademyAiGenerationJob` (orchestrator, long timeout, `tries` low, unique per job id)  
- Optional per-batch jobs if a single worker timeout is insufficient  

Follow legislation-sync UX: if `QUEUE_CONNECTION=sync`, API returns a warning that the request may time out.

Idempotency: `(job_id, item_type, idempotency_key)` unique. Retry skips completed keys.

---

## 18. Duplicate detection

Before insert, compare new stem (normalized whitespace/punctuation) against existing Academy question versions (draft + published).

v1: normalized exact/near-exact match.  
Optional: embedding similarity **only if** approved (O decision). Flag `likely_duplicate`; do not silently insert 20 paraphrases.

---

## 19. Cost controls

Admin-configurable: monthly USD budget, max questions/job, max source size, allowed models/providers, image limit/job, warning threshold.

Show **estimate** before large jobs when token math is feasible (rough). Track actual usage.

Hard-block new jobs when monthly budget exceeded (recommended). In-flight jobs finish or cancel explicitly.

---

## 20. Review workflow integration

| Actor | Allowed |
|-------|---------|
| AI importer | Create `draft` versions + links + validation rows |
| AI / system | **Never** `published`. **Never** `approved` |
| Admin | Existing transitions; override still audited |
| Consultant / staff | No generation APIs |

Human review UI compares: generated statement, snapshot excerpt, generated answer, validator answer, citations.

Partial regenerate creates a **new** version (existing `newDraftFromPublished` / draft-from-current pattern). Historical versions and past exam attempts stay intact.

---

## 21. Permissions

v1 generation APIs: `role:super-admin,admin` only (same as current Academy CMS).

Consultants and staff cannot generate official Academy course content.

No new team permission in v1 (instructor role deferred).

---

## 22. Security

- Never expose API keys, raw provider error bodies that might echo secrets, or full system prompts to learners  
- Admin APIs must not return `OPENAI_API_KEY`  
- IDOR: jobs scoped; only admins list all jobs  
- Uploaded source files on private Academy disk  
- Allow-listed retrieval hosts  
- Prompt injection: treat uploaded/source text as untrusted data, not instructions  
- Rate-limit generation endpoints  
- Do not send in-progress exam answer keys anywhere (unchanged)  

---

## 23. What this plan must not change

- `AcademyExamService` timer/scoring/key strip  
- `AcademyAccess` entitlement  
- Course pin / switch-latest  
- Client LMS tables and APIs  
- Phase 0–6 case journey  
- Stripe / referral / wallet / team ACL behavior  
- Maple production behavior  
- Existing Academy review status set (no new publishable status)  

Additive only: new `academy_ai_*` tables, new admin routes/UI, optional provenance columns, draft inserts through current CMS services.

---

## 24. Tests (required)

1. Admin can create a generation request  
2. Non-admin blocked (403/404 per existing admin convention)  
3. Provider factory returns OpenAI when configured; Manus stub disabled  
4. Structured output validates against schema  
5. Invalid model JSON rejected/retried then item-failed  
6. Source pack stored  
7. Source snapshot preserved (hash + timestamp)  
8. Course blueprint generated  
9. Blueprint editable before content generation  
10. Lesson generation creates draft lessons  
11. Independent MCQ generation  
12. Case generation  
13. Case-based MCQ linked to case version (case text not duplicated per question)  
14. Exactly one correct option  
15. Unsupported citation flagged `citation_unverified`  
16. Validator disagreement flagged  
17. Ambiguous question flagged  
18. Generated items remain `draft`  
19. AI cannot publish (direct status write / transition to published denied)  
20. Existing legal-review path still required for publish  
21. Regenerate one question only  
22. Prior question version + historical attempt `question_version_id` unchanged  
23. Duplicate detection flags near-duplicates  
24. Job resumable from failed step  
25. Retry does not duplicate entities  
26. Cancel job  
27. Provider timeout handled  
28. Provider 429 handled  
29. Usage/cost recorded  
30. API key never in JSON responses  
31. Image metadata recorded  
32. Image failure leaves textual course  
33. Mock pool respects requested independent/case counts  
34. Topic mix enforced at generation  
35. Difficulty mix enforced at generation  
36. Client LMS regression (no LMS behavior change)  
37. Academy Phase 1–9 regression (`--filter=Academy`)  
38. Case journey regression  
39. Subscription hardening regression  
40. Referral/wallet regression  
41. Team/staff regression  
42. Manus disabled → OpenAI-only generation works  
43. Manus configured → research task can be created through mocked v2 API  
44. Manus structured-output result parsed correctly  
45. Manus research URL does not bypass source allow-list  
46. Manus failed task falls back/fails according to configured policy  
47. Manus webhook signature verification  
48. Duplicate Manus webhook/event is idempotent  
49. Research output cannot directly create/publish Academy content  
50. OpenAI Responses structured output validates against the required schema  
51. Prompt injection inside a source snapshot cannot alter system workflow rules  
52. Independent validator is not given the generated correct answer  
53. Neither provider can move content beyond `draft`  

Fake providers in PHPUnit except mocked HTTP for OpenAI Responses / Manus v2. Tests may only reset `db_academy_test`.

---

## 25. Phases

| Phase | Work |
|-------|------|
| **0** | Confirm OpenAI key path, queue worker, Academy CMS import points, official Manus v2 + Responses API. |
| **1** | `config/academy_ai.php`, split research/generation providers, OpenAI Responses client, optional Manus v2 research adapter, prompt versions, usage records. |
| **2** | Source packs, snapshots, retrieval allow-list, upload extract. |
| **3** | Blueprint + lesson generation + draft import. |
| **4** | Independent MCQ + case + case-MCQ generation. |
| **5** | Validation passes, citation flags, duplicate detection. |
| **6** | Image generation + media approval. |
| **7** | Queue orchestration, progress, retry, cancel, resume. |
| **8** | Admin AI Content Studio UI, review UX, cost controls. |
| **9** | Full matrix + `VERIFICATION.md`. No production deploy. |

Phases 5–7 may overlap once draft import exists, but UI (8) should consume stable job APIs.

---

## 26. Files likely to change (after approval — not now)

**New**

- `backend/config/academy_ai.php`
- `backend/database/migrations/*_create_academy_ai_tables.php` (+ additive provenance columns)
- `backend/app/Services/Academy/Ai/*` (providers, pipeline, retrieval, validation, prompts)
- `backend/app/Jobs/RunAcademyAiGenerationJob.php`
- `backend/app/Http/Controllers/Admin/AdminAcademyAiController.php`
- `backend/tests/Feature/Academy/AcademyAiContentTest.php`
- `frontend/Admins Dashbord/app/dashboard/(auth)/admindashboard/academy/ai-studio/`

**Touch (additive)**

- `routes/api.php` admin Academy group  
- Admin `nav-main.tsx` / Academy admin page tabs  
- `.env.example` Academy AI keys/models (placeholders only)  
- `config/academy.php` only if a pointer to `academy_ai` is useful  

**Do not touch**

- Case Phase 0–6 services / frozen tag  
- Stripe / referral qualification  
- `lms_*` / `LmsExamService`  
- Maple production prompts / `MapleAiBoundaries`  
- `AcademyExamService` scoring/timer/strip  
- `AcademyAccess` rules  

---

## 27. Risks

| Risk | Mitigation |
|------|------------|
| Hallucinated law | Source pack + snapshots + citation verification + human legal review |
| Silent web browsing | Allow-listed retrieval only; no model-as-browser |
| AI publishes | Importer can only create `draft`; workflow rejects AI actor for publish |
| One-shot 500-question call | Batches + jobs |
| Duplicate bank spam | Normalized duplicate check + flags |
| Cost blow-up | Budget, max/job, estimates, usage table |
| Manus vaporware | Disabled stub; no fake endpoints |
| Maple contamination | Separate namespace; do not call WorkspaceAiAdvisorService |
| Changing exam mix at sit time | Generator enforces mix; engine unchanged unless later plan |
| Key leak | Masked settings; tests assert absence |
| Image endorsement | Prompt blocklist + admin media approval |
| Over-claiming accuracy | Copy lock; coarse admin labels only |

---

## 28. VERIFICATION.md (after coding — not now)

Must record: provider/config, schema, source snapshot samples, job lifecycle, validation flags, draft-only proof, Academy/LMS/case/billing/wallet/team regressions, remaining limitations, confirmation no production deploy.

---

## Recommended locked decisions (approve to lock)

| # | Recommendation |
|---|----------------|
| **R1** | Additive AI factory on `db_academy`. Do not extend client LMS or Maple chat. |
| **R2** | Provider interface; OpenAI is the v1 working provider. |
| **R3** | Manus official API v2 may be an **optional research-only** provider. Do not use v1. Do not invent endpoints. Academy must work fully with OpenAI when Manus is not configured. |
| **R4** | Structured JSON Schema outputs; no free-form DB writes. |
| **R5** | Models/timeouts/budgets via config/env, not hardcoded call-site strings. |
| **R6** | Staged, queued, resumable pipeline. No whole-course HTTP generation. |
| **R7** | Source-first + snapshots. No silent random internet law. |
| **R8** | Generated Academy rows start as `draft`. AI cannot publish or approve. |
| **R9** | “AI Generated” is job/provenance, not a new `AcademyWorkflow` status. |
| **R10** | Blueprint approve gate before lesson/question generation (course jobs). |
| **R11** | Batch question generation; larger mock **pool** than one sitting; do not auto-publish exams. |
| **R12** | Five-pass validation; flags block auto-approve; 100% score ≠ publish. |
| **R13** | Learner UIs never show internal confidence percentages. |
| **R14** | Images optional; admin must approve media; no fake official seals/forms. |
| **R15** | Admin/super-admin only. |
| **R16** | Reuse existing OpenAI Integrations key unless `ACADEMY_OPENAI_API_KEY` is set. |
| **R17** | Do not change Academy exam engine, entitlement, or versioning behavior. |
| **R18** | No production deploy; no `migrate:fresh`; no Phase 0–6 change. |
| **R19** | No AI rewrite of outdated legal sources (human outdated queue remains). |
| **R20** | Prompt versions in code/config, not migrations. |

---

## Open decisions (need your approval)

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| **O1** | API key | shared Integrations `OPENAI_API_KEY` / dedicated Academy key only / both (override) | **both: shared default + optional `ACADEMY_OPENAI_API_KEY` (R16)** |
| **O2** | Structured API | chat/completions `json_schema` / Academy client uses Responses API | **OpenAI Responses API + strict `text.format` JSON Schema** (Maple/Legislation/Letters stay on Chat Completions) |
| **O3** | Image model | config `ACADEMY_AI_IMAGE_MODEL` / skip images in v1 | **config-driven images in Phase 6** |
| **O4** | Duplicate detection | normalized text only / add embeddings | **normalized text in v1; embeddings later** |
| **O5** | Budget enforcement | hard-block / warn only | **hard-block new jobs when monthly budget exceeded** |
| **O6** | Snapshot payload | file on `ACADEMY_MEDIA_DISK` / inline excerpt only / both | **file + hash + short excerpt** |
| **O7** | After successful validation | stay `draft` until human sends to `content_review` / auto `content_review` | **stay `draft`; Review Queue action moves to `content_review`** |
| **O8** | Unknown topic/competency keys | auto-create taxonomy / flag and skip | **flag and skip; do not silently invent taxonomy** |
| **O9** | Exam engine mix | leave engine as-is / also sample by topic at sit time | **leave engine as-is (R17); generator enforces mix** |
| **O10** | Default IRB pool size | 300+300 / admin-only no default / match 95+95 | **admin-required counts; UI example 300+300, never auto 190 publish** |
| **O11** | Retrieval allow-list | strict official hosts / any admin URL | **strict allow-list + explicit admin “trust this host” override with audit** |
| **O12** | Manus in v1 | disabled stub / optional research adapter / full generation | **optional research-only adapter via official API v2; default disabled** |
| **O13** | Settings home | AI Studio tab / Integrations page | **AI Studio Settings tab; key still from Integrations unless override** |
| **O14** | Lesson images default | on / off unless checked | **off unless admin checks “Generate images”** |
| **O15** | Batch size | 5 / 10 / 20 questions | **10 default, configurable** |

---

## Locked decisions (approved 2026-09-14)

**R1–R20 approved**, with **R3 replaced** (optional official Manus API v2 research provider).

**O1–O15 approved with recommended choices**, except:

- **O2 replaced:** Academy OpenAI provider uses the **Responses API** + strict Structured Outputs. Existing Maple / Legislation / Letters Chat Completions call sites are not migrated.
- **O12 replaced:** Implement Manus as an **optional research-only adapter in v1** (`ACADEMY_MANUS_ENABLED=false`, `MANUS_API_KEY=`). When both are set, research may use Manus; otherwise OpenAI-only. Manus is never a required dependency and never authoritative law.

Also locked from the approval addendum:

- Split `AcademyResearchProvider` vs `AcademyGenerationProvider`; `AcademyAiOrchestrator` selects by config.
- Hybrid pipeline: Source Pack → Research Orchestrator (Manus if enabled else OpenAI) → candidate verification → allow-listed retrieval → immutable snapshots → OpenAI structured generation → blueprint gate → lessons/MCQs/cases → citation mapping → five-pass validation (Pass 3 never sees generated `is_correct` / correct key / revealing explanation) → optional OpenAI images → **draft import** → human `content_review` → RCIC/legal review → approved → published.
- Citation labels are not proof; compare to stored snapshots; unverified → `citation_unverified`, stay draft.
- Treat uploads, webpage text, Manus notes, and retrieved files as untrusted (prompt-injection tests required).
- Blueprint gate remains: Generate Blueprint → admin edit → explicit approve → generate. No Generate → Publish.
- Human review remains mandatory even if validation/research scores are high.
- Track OpenAI and Manus usage separately; never fabricate Manus cost.
- Tests 42–53 added.
- Batch size default 10, configurable; normalized duplicate detection; hard monthly budget block; file + hash + short excerpt snapshots; unknown taxonomy keys flagged not auto-created; exam engine unchanged; lesson images off by default; admin/super-admin only; no AI rewrite of outdated law; no production deploy; no `migrate:fresh`; no Phase 0–6 changes.
