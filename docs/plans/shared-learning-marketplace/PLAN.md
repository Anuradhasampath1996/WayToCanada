# Shared Learning Marketplace — RCIC Academy + Client LMS

**Status:** **approved** — R1–R80 locked; O1–O21 as recommended; O22–O24 as replaced below; R81–R86 locked. Implement Phase 1 → 9.  
**Date:** 2026-09-14 (revision: O22–O24 replacements + accuracy architecture R81–R86)  
**Depends on:** RCIC Academy (`docs/plans/rcic-academy/PLAN.md`), AI Content Studio (`docs/plans/rcic-academy-ai-content/PLAN.md`), platform Stripe hardening (`docs/plans/subscription-billing-hardening/PLAN.md`), team/staff (`docs/plans/team-staff-access/PLAN.md`)  
**Working name:** Learning Marketplace  

**Out of scope until a later approved plan:** production deploy, `migrate:fresh`, merging Academy learner rows into Client LMS, public SEO course pages, fake ratings, live AI **publication** of legal content, synthetic listening audio / speaking scoring, RCIC case-handling Phase 0–6 or tag `rc-case-handling-phase-0-6`, Maple prompts, referral/wallet changes, a second live platform subscription, gifting a course to another user.

There is **no** separate “Academy commerce correction” document. Academy PLAN §17 already reserved `one_time_purchase`. **This plan is that commerce correction**, plus Udemy-style catalogs, English/French i18n, **Exam Master**, **exam-specific question banks**, **random (or fixed) mocks with immutable snapshots**, **Exam Evidence Research Packs**, and **exam-driven Manus + OpenAI generation for both domains**.

Do **not** describe RCIC Academy as official CICC exam material. Do not describe Client LMS courses as official IRCC exam papers.

---

## Implementation gate

1. Approve or rewrite the **Recommended locked decisions** and **Open decisions** below.
2. Then implement Phase 0 → 9 (including 8A / 8B / 8C) in order. Exam bank, random mocks, frozen snapshots, mandatory admin edit, and the **Exam Evidence Research Pack** (R61–R80) are in scope — not a later plan.
3. No production deploy from this plan.
4. No `migrate:fresh` on product/production `db_cws`, `db_lms`, or `db_academy`.
5. Do not modify Phase 0–6 case-handling or frozen tag `rc-case-handling-phase-0-6`.
6. Do not merge RCIC Academy learner data into Client LMS (or the reverse).
7. Do not weaken Academy sitting **security** (key stripping, server `expires_at`, attempt snapshot, pin). **Do** replace global question sampling with an exam/course-scoped bank, freeze option order on start, and add `random_pool` / `fixed_form`. Do not rewrite LMS scoring for legacy assigned quizzes except additively for new exam-master mocks.
8. Do not mix learning-course Checkout with platform subscription Checkout.
9. AI must **never** publish. Domain review/publish remains human. Do **not** claim or design for “100% AI accuracy”. Design for **maximum verifiable accuracy**: authoritative evidence, multiple validation layers, mandatory human review.

Phase 1 → 9 may proceed under this approval. No production deploy. No `migrate:fresh`.

After implementation: create `docs/plans/shared-learning-marketplace/VERIFICATION.md`.

---

## Product goal

Two products share a marketplace **UX**, not a learner database.

### Product A — RCIC Academy

Audience: licensed RCIC consultants; staff with `academy.learn`.  
Data: `db_academy`.

### Product B — Client LMS Marketplace

Audience: immigration clients.  
Data: `db_lms`.

### Authoring (this revision)

The **primary** admin content flow does **not** start at “Create Course”.

It starts at **Exam Master**:

```
Create / List Exam
→ exam metadata + official sources
→ audience + content language
→ exam structure
→ Exam Evidence Research Pack (Manus candidates + OpenAI cross-check)
→ allow-list → fetch → verify → snapshot → classify
→ Admin Approve Exam Evidence Pack
→ Generate Full Course with AI (blocked until pack verification)
→ OpenAI blueprint grounded in verified pack (not model memory)
→ Admin edit + Approve Blueprint
→ modules → lessons → MCQs → cases (when relevant)
→ exam-specific question bank (practice + mock eligible)
→ mock pools + mock templates (`random_pool` default)
→ images if enabled
→ eight-pass validation + coverage report
→ draft import
→ human / language / legal review (as required)
→ publish (human only)
→ marketplace listing (derived, not duplicated)
→ learner purchase
→ configured access (default 3 months)
```

This flow works for **both** RCIC Academy and Client LMS. Prompts, source policy, validation, and importers are **profile- and domain-specific**. One generic legal prompt for every exam type is forbidden.

Manual “Create Course” remains available and joins the same CMS / review / publish / catalog path.

---

## 0. Current architecture findings

### 0.1 RCIC Academy (live as of `27cbada`)

| Item | Finding |
|------|---------|
| Database | Separate Postgres `db_academy`, connection `academy`. Learner `user_id` is `db_cws.users.id` with **no FK**. |
| Courses | `academy_courses`: `title`, `slug`, `description`, `thumbnail_url`, `category` (free string), `difficulty`, `estimated_hours`, `access_tier` (`free` / `subscription` / `grant_required`), `status`, `current_published_version_id`. **No `exam_id`.** |
| Versioning | `academy_course_versions` + modules/lessons pinned on `academy_learning_progress.course_version_id`. |
| Progress | Completions, practice/exam attempts, bookmarks, notes, planner. |
| Entitlement | `AcademyAccess`: client → 404. Staff need `academy.learn`. Surface requires platform sub **or** grant. Reserved types include `one_time_purchase`. **No course Checkout today.** |
| Catalog | `GET /consultant/academy/courses` — published summaries only. English-hardcoded `AcademyShell`. |
| Admin | CMS + AI Content Studio. Studio jobs start from **track / free-text goal**, not an Exam Master. |
| “Exam” today | `academy_exam_templates` is a **mock sitting** (seeded IRB 190 / 240 / 95+95). It is **not** a real-world Exam Master. Do not overload it. |
| Sources | `academy_legal_sources` + snapshots in AI jobs. Allow-list is RCIC/legal hosts. |
| Tracks | IRB active; other tracks reserved. |

### 0.2 Client LMS (`db_lms`)

| Item | Finding |
|------|---------|
| Courses | `lms_courses` — title/slug/description/thumbnail/`is_published`. **No exam_id, price, duration, language, access_mode, versioning, or review workflow.** |
| Entitlement | Consultant **assigns** published courses. Client API lists assignments only. `LmsPathwayGate` requires `immigration_pathway`. |
| Engine | Lessons, quizzes, per-course question bank, homework. Timer is client countdown. |
| Categories | Admin-managed. Seeder: IELTS, CELPIP, PTE, NCLEX, TEF. Citizenship / TCF not seeded. |
| AI | **None.** No LMS importer, no LMS generation jobs. |
| Tests | No dedicated LMS feature tests. |

### 0.3 Commerce / Stripe

Platform Checkout remains the only path to `ConsultantSubscription`. Learning Checkout must be a new `mode=payment` type `learning_course` and must **never** fall through to platform-sub fulfillment.

### 0.4 Localization

`users.locale` is `en`/`fr` with **no PATCH endpoint**. Dashboards have no real i18n dictionaries (ad hoc payment-modal / subscription-guard only).

### 0.5 Team / staff

`lms.view` = client-workspace LMS assign. `academy.learn` = take Academy. Unchanged. Staff have their own `users.locale` and `learner_user_id`.

### 0.6 AI Content Studio (Academy only)

Hybrid providers **already exist**:

- Research: `AcademyResearchProvider` — Manus official API v2 optional, else OpenAI. Research notes only. Allow-list + snapshots still required.
- Generation: `AcademyGenerationProvider` — OpenAI Responses API + strict JSON Schema. Images via `/v1/images/generations`.
- Orchestrator: `AcademyAiOrchestrator` — research → blueprint gate → generate → five-pass validation → draft import.
- Jobs: `academy_ai_generation_jobs` in `db_academy`. **No `exam_id`, `product_domain`, `generation_profile`, or LMS importer.**
- Publish: AI cannot publish. `AcademyWorkflow` remains authoritative.

**Gap vs this revision:** Studio does not start from Exam Master; there is no **Exam Evidence Research Pack**; Client LMS generation does not exist; validation is five passes (this plan requires eight); one RCIC prompt catalog would be wrongly reused for citizenship/language exams.

### 0.7 Audience isolation (keep)

Client → Academy APIs 404. Academy progress is never an LMS assignment. `lms.view` does not grant Academy.

### 0.8 Academy sitting engine today (extend, do not weaken)

`AcademyExamService` already:

- Reuses an in-progress attempt (refresh does not draw a new set).
- Snapshots `question_id` + `question_version_id` in `question_set_json`.
- Sets `started_at` / `expires_at` on the server; `finalizeIfExpired()` scores on expiry.
- Strips keys until submit; `allow_review` exists on the template.
- Stores topic/competency/independent/case percents after score.
- Readiness label is **not** an official pass prediction.

**Gaps this revision closes:**

| Gap | Today |
|-----|--------|
| Bank scope | `publishedOfType()` samples **all** published Academy questions — a global bank. |
| Course isolation | Mocks are not course-entitlement scoped. |
| Mix JSON | `topic_mix_json` / `difficulty_mix_json` columns exist; **engine does not enforce them**. |
| Selection mode | Shuffle/take only. No `random_pool` vs `fixed_form`. |
| Option order | `randomize_options` is applied at **show()** time — refresh can reshuffle. Must snapshot at start. |
| Case version | Not stored on the attempt snapshot. |
| Recent-attempt avoidance | None. |
| Practice vs mock eligibility | No flags. |
| LMS mocks | Client countdown; no Academy-style server timer/snapshot. |
| Learner mock UI | JSON/basic pages, not a professional navigator/results dashboard. |

---

## 1. Shared vs separate — architecture decision

### Decision: **B — shared view-model + shared UI, domain-owned data** (least risk)

Unchanged from the previous draft, and now also applied to **Exam Master**, **Exam Evidence Packs**, and **AI jobs**.

| Layer | Shared? | Where |
|-------|---------|--------|
| Marketplace UI + catalog DTO | Yes (contract + per-app copies) | Consultant, Client, Admin |
| Exam Master DTO / Admin exams UI | Yes | Admin “Learning → Exams” |
| Exam rows + exam sources + **Evidence Packs** | **No** | `academy_exams` / `academy_exam_evidence_*` vs `lms_exams` / `lms_exam_evidence_*` |
| Course / lesson / **exam bank** / attempts | **No** | `db_academy` vs `db_lms` (pivots stay in-domain) |
| AI providers (Manus + OpenAI clients) | Yes (PHP) | Reuse existing Academy AI clients |
| Generation **profiles** (prompts, schema, validation, source policy) | Shared interface, **separate implementations** | `rcic_exam_prep` / `citizenship_exam_prep` / `language_exam_prep` |
| AI **jobs** | Domain tables | Extend `academy_ai_*`; add `lms_ai_*` |
| Draft **importer** | Domain-specific | `AcademyAiDraftImporter` vs `LmsAiDraftImporter` |
| Stripe payment ledger | Thin, `db_cws` | `learning_course_payments` pointers only |
| Learner entitlement / progress | **No** | Domain tables |

**Rejected:** a canonical shared course table in `db_cws`.  
**Rejected:** storing Client LMS drafts in `db_academy`.  
**Rejected:** one Exam Master table in `db_cws` as the source of truth (cross-DB FKs + mixed source policies). Admin UI may still look like one list.  
**Rejected:** treating Manus search hits or model memory as authoritative exam facts.

---

## 2. Recommended locked decisions

Marketplace / commerce / i18n (R1–R19, confirmed still correct). Exam Master, banks, mocks, and hybrid AI (R21–R60; **R20 replaced**). **Exam Evidence Research Pack (R61–R80)** plus **accuracy architecture (R81–R86)**. O1–O21 as recommended. **O22–O24 replaced** (not the earlier 90-day-only / robots.txt / admin-structure-as-verified wording).

| ID | Decision |
|----|----------|
| **R1** | Shared marketplace **UX + DTO**. Never copy Academy learner/question rows into `db_lms` or the reverse. |
| **R2** | Architecture **B**. No shared canonical course table in `db_cws`. |
| **R3** | Each domain owns catalog/commerce fields. CWS stores **payment attempts** only. |
| **R4** | Audience is `rcic` or `client`. v1 does **not** implement `both`. |
| **R5** | UI locale (`users.locale`) is independent of course `content_language`. |
| **R6** | Authenticated dashboards use locale state, not `/en/` `/fr/` routes. |
| **R7** | Marketplace / Academy-shell / LMS-marketplace / Exams / AI wizard chrome uses locale dictionaries. |
| **R8** | Missing French **metadata** falls back to English. Never a blank card. |
| **R9** | No runtime machine-translation of legal/lesson bodies. French RCIC content stays draft until language + legal review. |
| **R10** | Academy surface: RCIC or staff+`academy.learn`, plus platform sub or grant. Catalog browse does not require a course purchase. Premium bodies do. |
| **R11** | Existing `access_tier=subscription` Academy courses stay included with platform sub. New purchasable courses use `access_tier=purchase` + `one_time_purchase` + `ends_at`. |
| **R12** | Client LMS keeps assign + pathway gate. Per-course `access_mode`: `consultant_assigned` / `self_purchase` / `free` / `pathway_restricted` / `assigned_or_purchase`. |
| **R13** | Learning Stripe: `mode=payment`, `type=learning_course`, `product_domain`, `course_id`, `learner_user_id`. Fail closed. Academy payment never writes LMS; LMS payment never writes Academy. |
| **R14** | Default paid access **3 months**; admin-configurable; backend enforces expiry. |
| **R15** | Default currency **CAD**; schema stores `currency` char(3). |
| **R16** | Ratings deferred. No fabricated stars. |
| **R17** | Wishlist deferred. |
| **R18** | No public SEO course pages in this plan. |
| **R19** | Shared UI = typed contract copied per app (no new monorepo package in v1). |
| **R21** | `is_preview` on lessons; server-enforced. |
| **R22** | Refund revokes domain access; Expired → Renew. |
| **R23** | Client learning Checkout uses **platform Stripe**, not Connect. |
| **R24** | Staff locale and `learner_user_id` are the staff user. |
| **R25** | “Most Popular” uses real counts or is hidden. |

Exam Master + AI (this revision):

| ID | Decision |
|----|----------|
| **R20** | **Replaced.** AI generation is **implemented for both domains** via profiles + domain importers. Do **not** use `rcic_exam_prep` prompts for citizenship or language exams. |
| **R26** | **Exam ≠ Course ≠ Mock template.** Exam = real-world assessment. Course = our product (`exam_id → many courses`). Mock template / sitting = generated or manual exam simulation aligned to Exam Master structure. Do **not** store only free-text `target_exam`. Do **not** reuse `academy_exam_templates` as Exam Master. |
| **R27** | Exam Master is **domain-specific**: `academy_exams` (`product_domain=rcic_academy`, `audience=rcic`) and `lms_exams` (`product_domain=client_lms`, `audience=client`). Shared DTO + unified Admin UI. Admin can create future exams without a code change. |
| **R28** | Primary authoring flow is **Exam → Generate Full Course with AI**. Manual Create Course remains. **AI Generate Course requires `exam_id`.** |
| **R29** | Generation job inherits exam: domain, audience, authority, structure, language, source pack, counts, mock config. Admin does not re-type exam facts on the job. |
| **R30** | Hybrid providers stay as implemented: **Manus = optional research-only** (official API v2). **OpenAI = structured generation + images + validation.** Discovery ≠ approval. Neither publishes. |
| **R31** | Profiles: `rcic_exam_prep`, `citizenship_exam_prep`, `language_exam_prep`. Profile is chosen from exam (or explicitly overridden). Each has its own source policy, schemas, prompts, validation, mock rules. |
| **R32** | Shared PHP orchestration; **Academy importer → `db_academy` only**; **LMS importer → `db_lms` only**. Parallel `lms_ai_*` job tables. Do not migrate existing `academy_ai_*` into `db_lms` or `db_cws`. |
| **R33** | All generated rows are **draft**. Academy: existing `AcademyWorkflow`. LMS: add review statuses (`draft` → `content_review` → optional `language_review` → `approved` → `published`). RCIC/legal review is **required for Academy / `rcic_exam_prep`**. Citizenship/language: content (+ language) review, not CICC legal review. |
| **R34** | Mock **pool** may be larger than one sitting. Templates use `random_pool` by default (R45). Do not hardcode IRB sitting or pool sizes. |
| **R35** | Language-exam schema is **extensible** (reading / writing / listening / speaking; MCQ, writing prompt, listening item, speaking prompt). v1 generation may implement lessons + MCQs first; the engine must not assume MCQ-only forever. |
| **R36** | Published course **automatically** becomes catalog-eligible in the matching marketplace (`product_domain`). No manual duplicate listing. |
| **R37** | AI may **suggest** title/subtitle/outcomes/price/duration. **Admin must confirm commerce fields** before they are live Stripe/catalog prices. AI cannot finalize pricing. |
| **R38** | Exam and course marketplace metadata support EN/FR translations. Generated **content** language is a job setting (`en` / `fr`). |
| **R39** | Source policy is per profile. Manus URL candidates still pass that profile’s allow-list, retrieval, snapshot, and citation pipeline. |
| **R40** | Advanced synthetic listening audio / automated speaking assessment is **not** required in v1 generation (schema-ready only). |
| **R41** | Every Exam Master has a **domain-scoped exam question bank**. No uncontrolled global bank. Buying Course A never exposes questions from an unrelated exam. |
| **R42** | A question belongs to **one Exam Master**. It may be **linked** to one or more courses of **that same exam** via a pivot (practice_eligible / mock_eligible). Do not duplicate stems solely to share a bank. |
| **R43** | Practice and Mock are different products. Practice: learner-driven, filters, optional immediate feedback, incorrect review. Mock: timed, no in-progress keys/feedback, navigator, flag, submit once, auto-submit on expiry, results after submit. Do not mix behaviors. |
| **R44** | Mock access is **course-specific**. Entitlement to Course A unlocks only mocks (and practice pools) **attached to Course A**. Exam Master organizes content; the course is the commercial package. |
| **R45** | Mock template `selection_mode`: `random_pool` (default, including AI-generated mocks) or `fixed_form` (admin-chosen exact set). Counts/mixes come from the **template**; Exam Master supplies recommended structure. **Do not hardcode IRB.** |
| **R46** | Randomization runs **only at attempt create**, server-side. Never send the eligible bank to the browser for JS to pick. Snapshot: `question_version_id`s, case versions, **served option order**, `started_at`, `expires_at`. Refresh / re-login / retry must not change the set, order, options, or timer. |
| **R47** | Historical attempts keep the originally served versions forever. Admin edits create new drafts/versions; they must not mutate rows referenced by past `question_set_json`. |
| **R48** | Prefer questions the learner has not seen on **recent** submitted attempts for that template when the pool allows. If the pool is too small, **allow repeats rather than fail**. Preference weighting only; do not reveal selection logic on learner APIs; do not make draws predictable. |
| **R49** | Server timer is authoritative: `expires_at = started_at + template duration`. Frontend displays remaining time from server `expires_at` / `server_now`. Local clock, refresh, or API calls cannot extend it. |
| **R50** | On expiry: reject answer writes; idempotent finalize of saved answers; unanswered stay unanswered; score once; `submission_reason=time_expired`; expose result. Duplicate submit / concurrent expiry must not double-score. |
| **R51** | After submit, if `allow_answer_review_after_submit` (template; maps from today’s `allow_review` unless split): show selected, correct, explanations, citations, topic, competency. Never before submit. |
| **R52** | Result UI is a polished dashboard: score, %, correct/incorrect/unanswered, time used vs duration, attempt number, submitted at, readiness **label** (Academy: not an official pass prediction; LMS: domain-appropriate wording). Topic / competency / difficulty / independent vs case analytics from real attempt data only — never fabricated. |
| **R53** | Professional mock player: top bar (name, progress, time), question/case + options, Prev/Next/Flag/Clear, number navigator (answered / unanswered / flagged / current), Submit + confirmation summary. |
| **R54** | **AI output is never locked.** Admin can fully edit Exam Master, course, modules/lessons, questions, and mock templates after generation. Manual create of questions and mock templates **without AI** is mandatory. |
| **R55** | Granular AI regenerate (course / module / lesson / N questions / one question / explanation / case / mock pool / thumbnail) writes a **new draft/version** where versioning exists. Never silent overwrite of published versions used by attempts. |
| **R56** | AI factory for an exam **can** fill: course + modules + lessons + exam bank items + practice/mock eligibility + mock pool + mock template(s). Admin still owns final values, including mock configuration before publish. Generation **targets** (pool sizes) are Admin-configured, not hardcoded 600/400. |
| **R57** | Start Mock is transactional: entitlement → template → server select → snapshot → start/expiry. Idempotent start: one in-progress attempt per learner+template (existing reuse). No double-start from one click. |
| **R58** | LMS exam-master mocks use the **same sitting semantics** (server timer, snapshot, key strip, random_pool). Legacy assigned LMS quizzes keep current behavior until an admin attaches them to an Exam Master mock template. |
| **R59** | Template may configure: total count, independent/case counts, topic/competency/difficulty/section mix, question-order shuffle, option-order shuffle, case grouping, language, max attempts, `allow_answer_review_after_submit`. Unfilled mix fields mean “no constraint beyond eligibility.” |
| **R60** | Learner APIs return **only** the attempt’s selected questions. No answer keys while `in_progress`. Selection algorithm is not exposed. |
| **R61** | Before generating a full course, build a domain-owned **Exam Evidence Research Pack** for the selected Exam Master. Collect official blueprint, syllabus, competency framework, candidate handbook, structure, scoring, weighting, sample/practice/past papers **only where legally and publicly available**, current rules/timing/types/language/retake info. Full generation waits until the pack’s required verification stage completes. |
| **R62** | Source priority: (1) official exam authority/regulator (2) official board docs (3) official released sample/past papers (4) official handbook/study guide (5) official competency/syllabus (6) official government/legal sources (7) explicitly approved authoritative secondary (8) general secondary **context only**. Arbitrary search hits are never authoritative. |
| **R63** | May use official released past/sample/practice/public prep. Must **not** ingest leaked/stolen/dump/confidential/paywalled-without-permission/verbatim third-party prep. Unverifiable “past papers” → `unverified_exam_material` and never authoritative. |
| **R64** | Verified official samples/past papers may be analyzed for **patterns** (topic/competency frequency, type, stem/option style, scenario length, difficulty, cognitive skill, independent vs case, sections, terminology, time pressure). Store **derived metadata**, not a pirate bank. Generated questions must be **new** skill/competency tests — not verbatim copies and not obvious derivatives (names/numbers swapped). |
| **R65** | `ExamEvidencePack` (domain tables): exam_id, product_domain, researched_at, research_provider, last_verified_at, counts, found-flags (blueprint/syllabus/competency/structure), format confidence, unresolved conflicts, research summary. Items: type, authority, URL/file, title, publication/effective dates, retrieved_at, hash, official/unofficial, verification status, usage-permission classification, snapshot ref. **No API secrets.** |
| **R66** | Material disagreements (counts, duration, syllabus, scoring, topics, rules, format) → `exam_source_conflict`. Do not silently pick. Prefer newer official source, then effective date, then issuing authority; else Admin review. **Block full generation** if the conflict affects mock structure or correctness. |
| **R67** | Before generation, check currency of structure, counts, duration, syllabus, competencies, regulations, scoring, official guide version. Stale required evidence → `exam_reverification_required`. `Refresh Exam Research` may update the pack; **verified Admin approval** is required before replacing authoritative Exam Master fields. |
| **R68** | Manus stays research-only (`ResearchNotes`). It may hunt official pages, guides, public samples/past papers, syllabus, competencies, blueprint, coverage, structure changes, **candidates**. It cannot mark a source authoritative. Pipeline remains allow-list → fetch → verify → snapshot → classify → Evidence Pack. |
| **R69** | OpenAI runs an independent research/verification pass on critical facts (totals, duration, types, sections, syllabus, competencies, currency). Manus vs OpenAI disagreement is flagged for review. Neither silently overwrites the other or Exam Master. |
| **R70** | Blueprint generation **must** receive the verified Evidence Pack (structure, syllabus, competencies, official topics, pattern metadata, snapshots, language, learner level). No memory-only course structure. Each module maps to exam competencies/topics/evidence. |
| **R71** | Lessons record source/evidence mapping. Important factual/legal claims need snapshot-backed sources. Professional/legal unsupported claims are flagged. Do not fabricate statutory sections, tribunal rules, or official exam requirements. |
| **R72** | Each generated MCQ stores provenance: exam_id, job, profile, competency/topic, snapshots, evidence, difficulty, style/pattern category. Original questions only (R64). |
| **R73** | Question validation **eight** passes: (1) schema (2) source grounding (3) independent solve **without** generated `is_correct` (4) ambiguity (5) currency (6) exam relevance → `low_exam_relevance` (7) difficulty/style vs Evidence Pack → `style_mismatch` (8) duplicate / near-past-paper / near-bank-copy. Do not copy exam questions. |
| **R74** | Before `draft_ready`, compute an internal **coverage report** vs official competencies/topics/sections/high-priority areas and pool mix. Missing required areas → `coverage_gap`. Do not pretend completeness. |
| **R75** | Before publishing a mock pool/template, verify eligible-bank size and mix (topic/competency/difficulty/section/independent-case/language/source verification/duplicate rate). If it cannot satisfy the template: Admin sees `Insufficient Question Pool`. Do not silently weaken constraints unless the template explicitly allows fallback. |
| **R76** | Exam Master **Research / Evidence** UI: status, last verified, official sources/samples/past papers, syllabus/competency/structure status, conflicts, outdated, coverage. Actions: Refresh Research, Add/Remove/Disable/Verify Source, View Snapshot, Resolve Conflict, **Approve Exam Evidence Pack**, Generate Course. |
| **R77** | `Generate Full Course with AI` requires: Exam Master, generation profile, verified **minimum** evidence, no **blocking** conflicts, confirmed required exam structure. Admin may override **non-critical** warnings with an audited reason. **No override** when mock engine cannot function (e.g. missing duration/counts the template needs). |
| **R78** | All research is editable. Admin may correct format, sources, mappings, blueprint, lessons, MCQs, explanations, mocks. AI does not lock facts. Manual changes to authoritative Exam Master data audit: actor, previous, new, reason, timestamp. |
| **R79** | Never show “100% accurate”, “guaranteed correct”, or a model-generated numeric “AI accuracy = N%” unless mathematically derived from a defined measured test set. Provider/model confidence is not evidence. Operational statuses: Verified, Review Required, Source Conflict, Citation Unverified, Outdated, Coverage Gap, Critical Structure Unverified, Insufficient Question Pool. Publication is a human decision. |
| **R80** | Tests listed in §19 Evidence Pack matrix (1–24) **plus** extended tests (25–34) are mandatory alongside bank/mock and marketplace tests. |
| **R81** | Locked accuracy pipeline (order): Exam Master → Evidence Pack → Manus candidate research → OpenAI independent fact cross-check → allow-list → retrieval → source verification → source classification → immutable snapshot / permitted reference → conflict detection → currency check → Admin evidence approval → evidence-grounded blueprint → Admin blueprint approval → lessons → exam-specific bank → original practice MCQs → cases where relevant → mock pool → random/fixed templates → eight-pass question validation → course coverage validation → mock-bank sufficiency → draft import → human review → language review where needed → RCIC/legal review where needed → **human publish**. AI must never publish. |
| **R82** | Manus research output and OpenAI verification output are stored **separately** enough to identify agreement, disagreement, and supporting sources. The system then derives verification state. **Model agreement ≠ source verification.** If both models make the same claim but neither has an authoritative official source, the fact is **not** `verified`. |
| **R83** | Official/public past or sample papers are evidence for structure, topic/competency distribution, style, cognitive demand, scenario format, timing, option construction. They are **not** a source for copying questions. Generate new questions from competency + verified knowledge + pattern metadata. Do not create superficial derivatives by changing names/numbers/dates while keeping the same substantive question. |
| **R84** | Before a normal `Generate Full Course with AI` run, Admin must see an **Evidence Summary** (structure, authority, duration, question structure, syllabus, competency framework, sample/past-paper counts, conflicts, critical stale sources, pack approval). Only then enable Generate for a normal run. |
| **R85** | Every major generated artifact remains traceable and inspectable in Admin review: module → pack → competency/topic → snapshot/reference; lesson → source evidence; MCQ → exam/profile/competency/evidence/validation; mock → Exam Master → eligible pool → template rules → question versions. |
| **R86** | Retrieval permission (may we fetch?) is **not** storage/reuse permission. `robots.txt` alone never classifies a file as reusable. `usage_permission_status`: `official_public_reuse_allowed` / `official_public_reference_only` / `permission_unknown` / `restricted` / `prohibited`. Full-document snapshots only when reuse is clearly allowed. |

---

## 3. Open decisions (approve or replace)

| ID | Question | Recommended |
|----|----------|-------------|
| **O1** | Platform sub still includes current `subscription`-tier Academy courses? | **Yes** (R11). |
| **O2** | Who pays Client LMS `self_purchase`? | **The client**, platform Stripe. Assignment stays a non-charge grant. |
| **O3** | Shared frontend package in v1? | **No** (R19). |
| **O4** | Full French lesson bodies in v1? | **Generate in requested content language as drafts.** Marketplace metadata translations on the same course. Sibling `variant_of_course_id` when an exam has separate EN/FR **content** products. |
| **O5** | Client catalog before pathway? | **Yes for `self_purchase` and `free`.** Assigned / pathway_restricted stay gated. |
| **O6** | Lifetime access in v1 UI? | Schema allowed; hide in admin UI until needed. |
| **O7** | Learning payments table? | **`learning_course_payments` on `db_cws`.** |
| **O8** | Academy home? | Catalog grid as home; keep Dashboard / My Learning / Practice. |
| **O9** | Must **manual** courses also have `exam_id`? | **Optional.** AI generate **requires** exam. Manual may attach later. Catalog filter “by exam” hides unattached. |
| **O10** | Put Exam Master in `db_cws` as `learning_exams`? | **No** (R27). Domain tables. |
| **O11** | Move AI jobs to `db_cws`? | **No.** Keep/extend `academy_ai_*`; add `lms_ai_*`. Shared PHP orchestrator. |
| **O12** | LMS `legal_review` status? | **No** for citizenship/language. Content + language review only. Academy keeps legal review. |
| **O13** | v1 language-exam generation scope? | **Lessons + MCQs + mock MCQ pools.** Writing/listening/speaking **item types** in schema; generators stubbed/skipped until a later phase. |
| **O14** | Default generation profile mapping? | IRB / Entry-to-Practice → `rcic_exam_prep`. Citizenship → `citizenship_exam_prep`. IELTS/CELPIP/PTE/TEF/TCF → `language_exam_prep`. Admin may override. |
| **O15** | How far back does “recently seen” go? | Last **3 submitted** attempts for that learner + template. Weight, do not exclude absolutely. |
| **O16** | Case grouping default? | **On** for `rcic_exam_prep` (keep a case’s MCQs together). Off unless format requires it for citizenship/language. |
| **O17** | Pivot table names? | `academy_course_questions` / `lms_course_questions`: `(course_id, question_id)` unique, `practice_eligible`, `mock_eligible`. Question row has required `exam_id`. |
| **O18** | Split `allow_review` vs `allow_answer_review_after_submit`? | Add the explicit column; migrate existing `allow_review=true` → true. |
| **O19** | Score idempotency? | `UPDATE … WHERE status = in_progress` (compare-and-set) plus unique constraint on scoring side-effects where needed. |
| **O20** | Default AI pool size if Admin omits targets? | **2× sitting independent count** and **2× sitting case count** from Exam Master (not 600/400). Admin can raise. |
| **O21** | Where does the Evidence Pack live? | **Locked as recommended:** Domain tables: `academy_exam_evidence_packs` (+ items) and `lms_exam_evidence_packs` (+ items). Same isolation as Exam Master (R27). |
| **O22** | What is “verified minimum evidence” (R77)? | **Replaced (locked).** Admin-entered structure alone is **not** sufficient as the normal evidence basis. See §3.1. |
| **O23** | When is evidence stale (R67)? | **Replaced (locked).** Not a 90-day timer alone. See §3.2. |
| **O24** | Store full past-paper PDFs? | **Replaced (locked).** `robots.txt` is not copyright/reuse permission. See §3.3. |

**Locked:** O1–O21 as recommended. **O22–O24 as replaced in §3.1–§3.3.** Treat with **R1–R86** (R20 replaced).

### 3.1 O22 — Verified minimum evidence (locked replacement)

For `Generate Full Course with AI`, **Admin-entered structure alone is NOT sufficient** as the normal evidence basis.

**Mandatory:** at least **one verified official source from the actual exam authority / regulator / official exam board** that confirms the existence/current identity of the exam and supports at least part of its current structure.

Examples: official exam page; official candidate guide; official exam handbook; official exam blueprint; official syllabus; official government/regulator page.

**Critical structure:** any values required by the mock engine must be verified before a matching mock can be generated/published, including where applicable: duration, total questions, section structure, question type counts, scoring structure, case/independent distribution, exam language, mandatory section timing.

If those values cannot be verified: `critical_structure_unverified = true` and generation of the **affected mock/template** is blocked.

**Admin-entered information:** Admin may enter/correct exam structure manually. Store `entered_by`, `entered_at`, `reason`, supporting source/reference if available, verification status. Manual entry must **not** silently become “officially verified”. Status: `admin_asserted` until official evidence supports it.

Non-critical missing items (official samples, detailed competency framework, historical past papers) may remain warnings with an **audited override**.

### 3.2 O23 — Evidence staleness (locked replacement)

Do **not** rely only on a fixed 90-day timer.

Evidence becomes stale when **any** of the following occurs:

1. a newer official document/version is discovered  
2. a newer effective date is published  
3. the exam authority announces a format/rule change  
4. an existing authoritative source is removed/replaced  
5. an approved source hash materially changes  
6. its configured maximum verification interval expires  

Default maximum verification interval: **90 days** for RCIC/legal/regulatory exam evidence, **configurable by generation profile / exam**.

| Profile | Default max interval |
|---------|----------------------|
| `rcic_exam_prep` | 90 days |
| `citizenship_exam_prep` | 90 days |
| `language_exam_prep` | configurable by exam-board update cadence |

A detected official change must trigger reverification **immediately**, even if the previous verification happened yesterday.

Store `next_review_at` and `stale_reason` (`verification_interval_expired` / `new_official_version` / `source_content_changed` / `authority_change_notice` / `source_removed`).

Stale **critical** evidence blocks affected generation until reviewed.

### 3.3 O24 — Past-paper / official file storage (locked replacement)

Do **not** treat `robots.txt` as copyright or reuse permission.

Separate:

- **Retrieval permission** — whether our service may technically retrieve/access the file.  
- **Storage/reuse permission** — whether licence, terms, copyright status, or explicit permission allows us to retain/reuse the full document.

For official public past/sample papers:

If storage/reuse permission **clearly allows** retention, store: original file on private storage, URL, `retrieved_at`, content hash, licence/permission classification, source authority, derived pattern JSON.

If permission to retain the full file is **unclear**: do **not** permanently mirror the full document. Store where legally appropriate: canonical URL, hash/fingerprint, retrieval metadata, permitted short evidence excerpts, derived pattern metadata, source classification.

Never store: leaked dumps, stolen papers, confidential papers, unauthorized commercial banks.

`usage_permission_status`: `official_public_reuse_allowed` | `official_public_reference_only` | `permission_unknown` | `restricted` | `prohibited`.

Only appropriate statuses may feed stored full-document snapshots (R86).

---

## 4. Exam Master

### 4.1 Distinction (locked)

| Concept | Meaning | Examples |
|---------|---------|----------|
| **Exam** | Real-world assessment we prepare for | RCIC-IRB Specialization Exam; Canadian Citizenship Test; IELTS Academic |
| **Course** | Our educational product | “Complete RCIC-IRB Specialization Exam Preparation 2026”; “Citizenship Test Prep — 3 Month Access” |
| **Mock template** | A timed sitting configuration | `selection_mode` + counts + duration; not the Exam Master |

One exam → many courses (Full Prep, Fast Revision, Mock Pack, French Preparation).

Catalog cards show the **course**, with exam name as `target_exam` **from the Exam Master row**, not free text.

### 4.2 Schema (flexible JSON where structure differs)

Domain tables `academy_exams` / `lms_exams` (same columns, separate DBs):

| Field | Notes |
|-------|--------|
| `id` | Domain PK |
| `product_domain` | `rcic_academy` or `client_lms` (denormalized for DTO; implied by table) |
| `audience` | `rcic` or `client` |
| `key` / `slug` | Unique per domain. Admin-created; not a PHP enum. |
| `generation_profile` | Default profile for Generate Course |
| `name` | Default/display name (usually English) |
| translations | EN/FR `name`, `description` |
| `description` | |
| `exam_authority` | e.g. CICC, IRCC, IELTS, Paragon, Pearson, CCI, CIEP |
| `official_exam_url` | |
| `content_language` | `en` / `fr` / `bilingual` (exam itself) |
| `category_id` | Domain category |
| `status` | `draft` / `active` / `archived` |
| `thumbnail_url` | |
| `exam_format_json` | Flexible: `total_questions`, `duration_minutes`, `question_types[]`, `independent_mcq_count`, `case_based_mcq_count`, `sections[]` (e.g. Reading/Writing/Listening/Speaking), `skills[]`, `scoring_json` |
| `source_requirements_json` | Profile hints (must cite statute, official guide, etc.) |
| `last_verified_at` | |
| `created_by` | CWS user id, no FK |
| timestamps | |

Do **not** require every exam to fill independent/case counts (language exams will not). Empty sections stay empty.

**Sources:** `academy_exam_source_links` → existing `academy_legal_sources` (plus AI snapshots). LMS: `lms_exam_sources` (url, org, title, verified_at, status) with **profile allow-list**, not the RCIC legal host list.

**Evidence packs:** `academy_exam_evidence_packs` + `academy_exam_evidence_items` (and LMS equivalents). These are the research/verification layer. They do **not** replace Exam Master as the admin-authoritative record. Approved pack conclusions may be copied into Exam Master only after Admin verify/approve (R67, R78).

**Courses:** `academy_courses.exam_id` / `lms_courses.exam_id` nullable for manual legacy rows; **required on AI generate**.

### 4.3 Seeded exams (admin-editable, not hardcoded forever)

RCIC: RCIC-IRB Specialization Exam; RCIC Entry-to-Practice Exam.  
Client: Canadian Citizenship Test; IELTS Academic; IELTS General; CELPIP General; PTE Core; TEF Canada; TCF Canada.

Admin **Create Exam** adds any future exam without deploying code.

### 4.4 Admin UI — Learning → Exams

Nav: **Admin → Learning → Exams** (product filter: RCIC Academy | Client LMS), plus existing Academy CMS / LMS builder / AI Studio.

Exam page shows authority, languages, format (e.g. 190 questions / 240 minutes / 95+95), official sources count, last verified, linked courses, **question-bank stats**, **mock templates**, and a **Research / Evidence** panel (R76).

Actions: Edit Exam, Archive, Verify Information, Manage Sources, View Courses, **Question Bank**, **Mock Exams**, **Refresh Research**, **Approve Exam Evidence Pack**, **Generate Full Course with AI** (gated by R77).

### 4.5 Exam-specific question bank (mandatory)

Each Exam Master owns a bank in the **same domain DB**.

Academy questions gain required `exam_id` (nullable only for pre-existing rows until backfilled). LMS gets `lms_questions` extended **or** a new `lms_exam_questions` versioned model for exam-master mocks — do not dump RCIC questions into `db_lms`.

Bank item fields (domain-equivalent):

- type: `independent_mcq` / `case_based` / reusable case scenario (Academy cases stay `academy_cases` linked by `exam_id`)
- practice_eligible / mock_eligible (also on the **course pivot** so Course A and Course B can differ)
- difficulty, topics, competencies, `content_language`, workflow `status`
- source/citation links
- versioning (Academy already versions questions; LMS exam-master questions must version so attempts can freeze `question_version_id`)

**Reuse:** pivot `*_course_questions (course_id, question_id, practice_eligible, mock_eligible)`. Same exam only. Two courses for IRB may share a stem without duplicating text.

**Isolation:** Start Mock for Course A samples only questions linked to Course A with `mock_eligible`. Practice for Course A uses `practice_eligible` on that pivot. Unrelated exams never appear.

Admin: **Learning → Exams → [Exam] → Question Bank** with counts (total/published/draft/independent/case/difficulty/topic/competency/language/mock-eligible/practice-eligible/source status). Actions: Add (manual), Edit, Archive, Duplicate, Regenerate with AI, Validate Again, publish via domain workflow, bulk select, attach/detach course, mark practice/mock eligible.

**Manual Add Question without AI is required.** AI is optional assistance.

### 4.6 Mock templates: random_pool vs fixed_form

Extend `academy_exam_templates` (add `exam_id`, `course_id`, `selection_mode`, mix JSON actually enforced, `allow_answer_review_after_submit`, `competency_mix_json`, `section_mix_json`, `group_case_questions`). LMS: `lms_exam_templates` for exam-master mocks (do not overload leftover inline quizzes).

| Mode | Behavior |
|------|----------|
| `random_pool` (**default**, including AI-generated) | Each **new** attempt: server draws an eligible set matching counts/mixes. |
| `fixed_form` | Admin stores the exact question_version list. Every attempt serves that list (option order still follows template shuffle **once at attempt start** and is snapshotted). |

Example: bank 600 independent + 400 case; template 95+95 / 240 minutes → Attempt 1, 2, 3 each get a different eligible combination when the pool allows.

Admin: **Exam → Mock Exams → Create Mock Template** (all fields listed in the request). AI may prefill from Exam Master; **Admin owns final values**. Manual create without AI is required.

Generation scale: Admin sets pool targets. If omitted, O20 (2× sitting counts). **Do not hardcode 600/400.**

### 4.7 Attempt create (server-only)

```
validate entitlement (course-scoped)
→ validate published template
→ select eligible questions (never the full bank to the client)
→ apply template rules (counts, mixes, language, case grouping)
→ weight against recently seen (O15); if pool too small, allow repeats
→ snapshot question_version_id + case_version_id + served option_id order
→ started_at = server now
→ expires_at = started_at + duration
→ return attempt (in-progress questions only, no keys)
```

After this: refresh, browser close, re-login, API retry **must not** draw a new set, reshuffle options, or reset the timer. Historical attempts always show originally served versions.

Do **not** send the eligible bank to JavaScript.

### 4.8 Practice vs mock

| | Practice | Mock |
|--|----------|------|
| Timer | Optional / none | Server `expires_at` |
| Feedback | May be immediate per product rules | None in progress |
| Keys | After item or set, per practice config | Only after submit if review allowed |
| Navigation | Learner-driven filters | Exam navigator, flag, unanswered |
| Submit | N/A / per set | Once; auto-submit on expiry |
| Pool | `practice_eligible` for **this course** | `mock_eligible` for **this course** |

### 4.9 Server timer, auto-submit, concurrency

- Timer cannot be extended by local clock, refresh, or extra API calls.
- Expiry: reject mutations; finalize saved answers; unanswered remain unanswered; `submission_reason=time_expired`; `submitted_at`; score **once** (O19).
- Prevent: double-start, duplicate submit, answer-after-expiry, second score, mutating snapshot/option order.

### 4.10 Mock player + results + review

Professional player (R53). Submit confirmation: answered / unanswered / flagged counts.

Polished result dashboard (R52). Analytics by topic, competency, difficulty, independent vs case — **omit a chart if that dimension has no data**.

Readiness: Academy existing rule — **not an official pass prediction**. LMS: domain wording, no fake official pass probability.

Post-submit review gated by `allow_answer_review_after_submit`.

### 4.11 Manual edit is mandatory (AI never locks)

After research or a factory job, Admin may change:

- Exam Master metadata/structure/sources/profile
- Evidence Pack items (add/remove/disable/verify/resolve conflict)
- Course storefront + exam association (commerce still Admin-confirmed)
- Module/lesson titles, order, body, media, sources
- Question stem, type, case, options, correct answer, explanations, difficulty, topics, competencies, citations, eligibility
- Mock template configuration

AI research **does not lock facts**. When Admin changes authoritative Exam Master fields, audit: actor, previous value, new value, reason, timestamp (R78).

Edits go through **existing versioning + review**. Do not mutate published versions that past attempts reference (R47).

### 4.12 Granular AI regeneration

Regenerate: entire course draft, one module, one lesson, N questions, one question, explanation only, case, mock pool, thumbnail.

Always a new draft/version when the domain versions that entity. Historical attempts unchanged.

### 4.13 Exam Evidence Research Pack (mandatory before full generation)

Accuracy and relevance are critical. The system must research and understand the selected exam **as deeply as possible** before generating course content, practice questions, or mock exams.

Do **not** claim or design for “100% AI accuracy”. Design for **maximum verifiable accuracy**: authoritative evidence, multiple validation layers, and mandatory human review.

#### Purpose

Before `Generate Full Course with AI`, the system must build an **Exam Evidence Research Pack** for the selected Exam Master. Full generation does not start until the pack has completed its required verification stage (R61, R77).

#### Collect (where legally and publicly available)

- official exam blueprint
- official syllabus
- official competency framework
- official exam guide
- official candidate handbook
- official exam structure
- official scoring information
- official section/topic weighting
- official sample questions
- official practice questions
- official practice tests
- publicly released official past papers
- publicly released sample/mock papers
- official preparation materials
- official regulatory/legal sources where applicable
- current exam rules, timing, question types
- current allowed/forbidden materials
- current exam-language information
- current retake/attempt rules where relevant

Absence of an item is recorded honestly (`not_found` / warning). The system must not invent missing official documents.

#### Source priority (R62)

1. official exam authority / regulator  
2. official exam-board documentation  
3. official publicly released sample/past papers  
4. official candidate handbook / study guide  
5. official competency/syllabus documents  
6. official government/regulatory/legal sources  
7. explicitly approved authoritative secondary sources  
8. general secondary sources **only for context**

Never treat an arbitrary search result as authoritative.

#### Past-paper safety (R63)

**May use:** official released past papers; official sample questions; official practice papers; official public preparation material.

**Must not automatically ingest or reproduce:** leaked exam papers; stolen question banks; unauthorized dumps; confidential exam questions; paywalled commercial banks without permission; copyrighted third-party prep copied verbatim.

If a suspected past paper cannot be verified as legitimate and publicly released: mark `unverified_exam_material` and **do not** use it as authoritative generation evidence.

#### Pattern analysis (R64, R83, O24)

Where verified official sample/past papers exist, analyze for: topic frequency, competency frequency, question type, stem style, option structure, scenario length, difficulty, cognitive skill, case-based vs independent distribution, section structure, terminology, time pressure, recurring knowledge domains.

They are evidence for those patterns. They are **not** a source for copying questions. Generate new questions from competency + verified knowledge + pattern metadata. Do not create superficial derivatives by changing names, numbers, or dates while keeping the same substantive question.

Store **derived analytical metadata** (and hashes/fingerprints for near-copy checks). Full-file snapshot only when `usage_permission_status` clearly allows retention (O24, R86). `robots.txt` is not reuse permission.

Do **not** copy real exam questions verbatim into our question bank unless we clearly have permission.

#### Pack schema (R65, O21)

Concept: `ExamEvidencePack` in the **domain DB** (`academy_exam_evidence_packs` / `lms_exam_evidence_packs`).

Pack fields (conceptual):

- `exam_id`, `product_domain`
- `researched_at`, `research_provider` (`manus` / `openai` / `hybrid` / `admin`)
- `last_verified_at`
- source count, official-source count, official sample-paper count, public past-paper count
- `blueprint_found`, `syllabus_found`, `competency_framework_found`, `exam_structure_verified`
- `current_format_confidence`
- `unresolved_conflicts` (count / summary JSON)
- `research_summary`
- `status`: `researching` / `review_required` / `verified` / `source_conflict` / `outdated` / `coverage_gap` / `critical_structure_unverified`
- `approved_at`, `approved_by` (CWS user id, no FK)
- `next_review_at`, `stale_reason`
- `manus_research_json` and `openai_verification_json` stored **separately** (R82)
- `critical_structure_unverified` (boolean)

Items preserve: source type, authority, URL/file, title, publication date, effective date, `retrieved_at`, content hash, official/unofficial status, verification status (`verified` / `admin_asserted` / `unverified` / …), `usage_permission_status` (R86), snapshot reference (full file only if reuse allowed).

Admin-entered structure fields store: `entered_by`, `entered_at`, `reason`, supporting source/reference, verification status. Status remains `admin_asserted` until official evidence supports it (O22).

Do **not** store API secrets.

#### Conflicting sources (R66)

If two sources disagree about question count, duration, syllabus, scoring, topic structure, rules, or exam format: flag `exam_source_conflict`. Do **not** silently choose one.

Resolution order:

1. prefer newer official source  
2. compare effective dates  
3. compare issuing authority  
4. request Admin review if still unresolved  

Full generation is **blocked** when the conflict materially affects mock structure or correctness.

#### Currency (R67, O23)

Before generation, check whether core exam information is current: structure, question count, duration, syllabus, competencies, regulations, scoring, official study-guide version.

Evidence is stale when **any** of: newer official document/version; newer effective date; authority format/rule-change notice; authoritative source removed/replaced; approved source hash materially changed; configured max verification interval expired.

Defaults: 90 days for `rcic_exam_prep` and `citizenship_exam_prep`; `language_exam_prep` configurable by exam. Store `next_review_at` and `stale_reason`. A detected official change triggers reverification immediately.

If required **critical** evidence is stale: `exam_reverification_required` and block affected generation.

Admin action: **Refresh Exam Research**. Manus/OpenAI may refresh the pack. Updates **require verification** before replacing authoritative Exam Master data. Refresh must not silently overwrite approved fields.

#### Manus vs OpenAI (R68–R69)

Manus remains research-only. For the selected exam it may research: official authority and pages, current candidate guides, official sample/practice materials, official past papers where publicly released, syllabus, competency profiles, exam blueprint, official topic/skill coverage, official preparation documents, current structure changes, potentially relevant source **candidates**.

Output remains `ResearchNotes`. Manus cannot directly make a source authoritative or alter Exam Master.

Every candidate still goes: allow-list → fetch → verify → snapshot → classify → Evidence Pack.

OpenAI runs an independent research/verification pass on critical facts: total questions, duration, question types, section structure, official syllabus, competencies, source currency.

If Manus and OpenAI disagree: flag for review. Do **not** silently let one provider overwrite the other.

Store Manus research and OpenAI verification **separately**. If both models agree but **neither** cites an authoritative official source, the fact is still **not** `verified` (R82).

#### Evidence-grounded generation (R70–R72)

**Blueprint** input must include: verified exam structure, syllabus, competencies, official topic areas, sample/past-paper-derived pattern metadata where available, source snapshots, language, target learner level. The model must not create course structure from model memory alone. Each module maps back to one or more exam competencies/topics/evidence sources.

**Lessons** record source/evidence mapping. Important factual or legal claims must be supported by snapshot-backed sources. For professional/legal courses, unsupported factual claims are flagged. Do not fabricate statutory sections, tribunal rules, or official exam requirements.

**MCQs** store provenance: `exam_id`, generation job, generation profile, exam competency/topic, source snapshots, source evidence, difficulty, question style/pattern category. Questions are original (R64).

#### Eight-pass question validation (R73)

Extends the existing five passes. For every important MCQ:

| Pass | Name | Rule |
|------|------|------|
| 1 | Schema/structure | Existing |
| 2 | Source grounding | Existing; snapshot-backed |
| 3 | Independent answer solve | Validator must **NOT** see the generated correct answer |
| 4 | Ambiguity | Existing |
| 5 | Currency | Existing |
| 6 | Exam relevance | Tests a competency/topic of **this** Exam Master. Flag `low_exam_relevance` |
| 7 | Difficulty/style alignment | Compare vs Evidence Pack and verified sample-question patterns. Flag `style_mismatch` |
| 8 | Duplicate / near-past-paper | Too similar to an ingested official/public sample or another bank question. Do not copy exam questions |

#### Coverage gates (R74–R75)

Before the complete course is marked `draft_ready`, compute an internal coverage report, for example:

- Official competencies covered: 18/18  
- Syllabus topics covered: 24/25  
- High-priority topics covered: 100%  
- Exam sections represented: 4/4  
- Question pool mix (Reading / Writing / … or, for RCIC: Foundations, ID, IAD, RPD, RAD, Ethics, Legal research, etc.)

Missing important required areas → `coverage_gap`. Do not pretend the generated course is complete.

Before publishing a mock pool/template, verify the eligible bank is large and representative enough: eligible count, topic/competency/difficulty/section mix, independent/case mix, language, source verification, duplicate rate.

If the bank cannot satisfy the Mock Template reliably: Admin sees **Insufficient Question Pool**. Do not silently weaken required constraints unless the template explicitly permits fallback.

#### Research / Evidence UI (R76)

Exam Master page includes **Research / Evidence**:

- research status, last verified date
- official sources, official sample materials, official past papers found
- syllabus status, competency framework status, exam structure status
- unresolved source conflicts, outdated evidence, coverage summary

Actions: Refresh Research, Add Source, Remove/Disable Source, Verify Source, View Snapshot, Resolve Conflict, **Approve Exam Evidence Pack**, Generate Course.

#### Generation gate (R77, R84, O22)

`Generate Full Course with AI` requires:

- Exam Master exists
- generation profile exists
- **verified minimum evidence** (O22): at least one verified **official authority/board** source confirming exam identity and supporting at least part of current structure. Admin-entered structure alone is **not** enough for a normal run.
- Exam Evidence Pack has no **blocking** conflicts
- required exam structure is confirmed **from official evidence** where the mock engine needs it
- Evidence Summary shown; pack **APPROVED**

If mock-engine-required values cannot be verified: `critical_structure_unverified = true` and generation of the **affected mock/template** is blocked. Admin may enter/correct structure as `admin_asserted`; that does not become `verified` until official evidence supports it.

Admin may override **non-critical** warnings (samples, detailed competency framework, historical past papers) with an audited reason.

Do **not** permit override of missing **critical** structure where the mock engine cannot function.

**Evidence Summary** (must be shown before enabling Generate for a normal run):

```
Exam Structure: Verified
Official Authority: Verified
Current Duration: Verified
Question Structure: Verified
Syllabus: Verified / Not Found
Competency Framework: Verified / Not Found
Official Samples: 3
Official Public Past Papers: 1
Source Conflicts: 0
Critical Stale Sources: 0
Evidence Pack: APPROVED
```

#### Accuracy positioning (R79)

Never show `100% accurate`, `guaranteed correct`, or a model-generated `AI accuracy = 98%` (unless mathematically derived from a clearly defined measured test set). Provider/model confidence is not evidence.

Operational statuses only:

- Verified
- Review Required
- Source Conflict
- Citation Unverified
- Outdated
- Coverage Gap
- Critical Structure Unverified
- Insufficient Question Pool

Final publication remains a human-reviewed decision.

---

## 5. Required core authoring flow

```
Admin: Create/List Exam
→ metadata + sources + audience + language + structure
→ Research Exam Evidence Pack (Manus candidates + OpenAI cross-check)
→ allow-list → fetch → verify → snapshot → classify
→ Admin Approve Exam Evidence Pack (R76–R77)
→ Generate Full Course with AI (blocked until verified minimum evidence, no blocking conflicts)
→ job inherits exam_id + profile + **verified Evidence Pack**
→ OpenAI blueprint **grounded in the pack** (not model memory)
→ Admin edit + Approve Blueprint
→ OpenAI lessons / exam-bank MCQs / cases (if profile allows) / mock pool + random_pool templates / images
→ eight-pass validation + coverage report (R73–R74)
→ domain draft import (`draft` / `coverage_gap` as applicable)
→ human content review
→ language review if French
→ legal/RCIC review if Academy
→ approved → published (human only)
→ catalog listing derived from published course
→ Stripe purchase → entitlement for configured period (default 3 months)
```

AI Studio **product selector**: RCIC Academy | Client LMS → select or create Exam → **Research / Evidence** → profile auto-fills → content language → generate checkboxes. `Generate Full Course with AI` is disabled until the Evidence Pack gate passes (R77).

---

## 6. Course generation wizard (Admin)

1. **Choose Exam** — select or create.  
2. **Verify Exam** — authority, format, languages, last verified, sources.  
3. **Research / Evidence Pack** — Refresh Research, review official sources/samples/past papers, syllabus/competency/structure status, conflicts, outdated flags. Show **Evidence Summary** (R84). **Approve Exam Evidence Pack**. Generate Course stays blocked until official minimum evidence, no blocking conflicts, and no `critical_structure_unverified` for required mock values. Admin-entered structure stays `admin_asserted`.  
4. **Course settings** — title, content language, difficulty, hours, **suggested** price/currency/duration (defaults 3 months / CAD), thumbnail. Commerce not live until Admin confirms (R37).  
5. **AI generation options** — syllabus, modules, lessons, practice MCQs, case-based MCQs (hidden/disabled if profile has no cases), mock pool, images.  
6. **Blueprint** — generate from **verified Evidence Pack** → admin edit → Approve Blueprint.  
7. **Generate draft** — OpenAI grounded generation → eight-pass validate → coverage report → import drafts.  
8. **Review** — content / language / legal as required. Coverage gaps and validation flags remain visible.  
9. **Marketplace** — publish makes it catalog-eligible in the correct product. Unchanged storefront fields can still be edited. Human publish only.

---

## 7. Hybrid AI (Manus + OpenAI)

Reuse existing clients. Do not invent Manus v1 endpoints. Do not migrate Maple Chat Completions.

| Provider | Role |
|----------|------|
| **Manus** | Optional. Research-only (`ResearchNotes`). Hunt official exam authority/pages, current candidate guides, official sample/practice materials, official past papers **where publicly released**, syllabus, competency profiles, blueprint, official topic/skill coverage, official prep documents, current structure changes, source **candidates**. Cannot mark a source authoritative. Cannot write Exam Master. |
| **OpenAI research** | Independent verification pass on critical facts: totals, duration, types, sections, syllabus, competencies, currency. Disagreement with Manus is flagged; neither silently overwrites the other. |
| **OpenAI generation** | Only after Evidence Pack verification. Receives verified pack + snapshots → blueprint, modules, lessons, MCQs, cases (RCIC profile), explanations, mappings, citations, mock pools/templates, image prompts, eight validation passes. Must not generate structure from model memory alone. |

Pipeline for every source candidate:

```
allow-list → fetch → verify → snapshot → classify → Evidence Pack
```

Manus candidates that fail the **profile** allow-list are non-authoritative. Unverified past papers stay `unverified_exam_material`. OpenAI must not treat unsnapshotted URLs as truth.

Neither provider can publish or legally approve. Neither can claim “100% accurate”.

---

## 8. Generation profiles

### 8.1 `rcic_exam_prep`

Domain: `db_academy` only.  
Sources: CICC, IRB, Canada.ca, Justice Laws, IRPA/IRPR, existing Academy allow-list. Evidence Pack required before full generation.  
Output: professional/legal lessons **with claim provenance**, independent MCQs, case-based MCQs, scenarios, mock exams, legal explanations, citations. Unsupported factual/legal claims flagged. Do not fabricate statutory sections, tribunal rules, or official exam requirements.  
Review: content + **legal/RCIC** before publish.  
Do not use for citizenship or IELTS.

### 8.2 `citizenship_exam_prep`

Domain: `db_lms` only.  
Sources: official/current Canadian citizenship study materials (IRCC Discover Canada / current official guide URLs — allow-list maintained in config, not IRB hosts). Evidence Pack required before full generation. Official guide version is a currency check (R67).  
Output: syllabus, study lessons, practice questions, topic quizzes, timed mocks, explanations, revision.  
No IRB case-scenario schema. No CICC legal-review gate (content + language review).

### 8.3 `language_exam_prep`

Domain: `db_lms` only.  
Examples: IELTS, CELPIP, PTE, TEF, TCF.  
`exam_format_json.sections` holds skill structure (Reading / Writing / Listening / Speaking as applicable).  
v1 generate: lessons + MCQ practice + mock MCQ pool where the exam uses MCQs.  
Schema allows writing prompts, listening items, speaking prompts later (O13).  
Source policy: official exam-board pages for that exam key; **not** RCIC legal prompts. Evidence Pack required; leaked/paywalled dumps never ingested (R63).

---

## 9. Full course generation output (always draft)

A successful exam-driven job **can** produce:

- Course product draft (title/subtitle/description/outcomes/thumbnail suggestion)
- Modules + lessons + image suggestions
- Practice MCQs + explanations + incorrect-option explanations
- Reusable cases + case-based MCQs (**RCIC profile**; skipped for citizenship/language unless format says so)
- Topic/competency mappings (Academy); topic strings (LMS)
- Citations (required for RCIC; official-guide citations for citizenship)
- Mock question pool **and** `random_pool` mock template(s) linked to **exam + course**
- Study-plan recommendations (Academy planner JSON or LMS homework/outline)

Importer writes questions into the **exam bank**, then pivot-links them to the new course with practice/mock eligibility. Mock template `course_id` + `exam_id` required. Academy generation never inserts `lms_*`. LMS generation never inserts `academy_*`. Everything remains Admin-editable (R54).

Blueprint, lessons, and MCQs must carry Evidence Pack provenance (R70–R72). Jobs that skip the pack or generate from model memory alone are invalid.

Before `draft_ready`: coverage report (R74). Before mock template publish: bank sufficiency check (R75). `coverage_gap` and `Insufficient Question Pool` are visible Admin states — never silent completeness.

Do not surface “100% accurate” or “guaranteed correct” on generated drafts (R79).

---

## 10. Mock exams vs Exam Master

Exam Master = recommended structure. Mock template = actual sitting. Default `selection_mode=random_pool`.

Example: Exam Master IRB 190 / 240 min / 95+95. Admin may generate a **reviewed bank** larger than one sitting (Admin-configured; O20 default 2×). Template still sits 95+95 / 240. Attempts 1–n draw different eligible sets when the pool allows.

LMS exam-master mocks use `lms_exam_templates` + server timer/snapshot (R58). Do not hardcode IRB. Do not let Course A’s purchase start Course B’s template.

---

## 11. Course-product / catalog architecture

Unchanged in spirit: shared DTO, domain columns, catalog derived from **published** courses.

`LearningCatalogCard` uses `exam_id` + localized exam name instead of free-text `target_exam`. Filter “Target Exam” queries Exam Master.

Additive domain fields remain: subtitle, translations, price, currency, duration, access mode, featured, `content_language`, `variant_of_course_id`, `is_preview`, `exam_id`.

Marketplace listing is **not** a second table. Publish ⇒ catalog query includes the row.

---

## 12. Multilingual / i18n

Three layers remain: UI locale, marketplace metadata locale, content language.

Exam metadata translations: EN/FR names/descriptions.  
Course metadata translations: as before.  
French generated RCIC content: official bilingual terminology where available; draft; language review; legal review; no auto-publish.

`PATCH /api/v1/me/locale`. Staff own locale. Dictionaries for marketplace + exams admin + AI wizard + Academy/LMS learning chrome.

---

## 13. Learner status, filters, UX

Statuses/CTAs, Udemy-style grids, Academy vs Client catalogs, My Learning, preview, accessibility, shared presentational components — **unchanged** from the previous draft (sections 7–12, 20–21 of the prior version). Filter “Target Exam” is now Exam Master, not a string.

Client “Recommended for You” may use `exam_id` / pathway / assignment — still transparent, no fake ML.

---

## 14. Admin course management

Product selector first. Domain builders stay separate.

Each course: attach `exam_id`, commerce tab (Admin-confirmed), EN/FR metadata, preview EN/FR desktop/mobile.

Two entry points: **Create Course Manually** | **Generate Course from Exam with AI**.

---

## 15. Commerce (separate from AI)

After (or during) settings, Admin confirms:

- price, currency, access duration, purchase/access mode

Examples: RCIC-IRB course CAD 149 / 3 months; Citizenship CAD 49 / 3 months.

AI suggestions are not Stripe facts until confirmed.

Fulfillment path unchanged: Checkout → `learning_course_payments` → domain entitlement → expiry → Renew.

---

## 16. Security (additions)

In addition to prior marketplace rules:

- Generate Course without `exam_id` → 422.  
- Generate Course without approved/verified **minimum** Evidence Pack, or with blocking `exam_source_conflict` / missing critical structure → 422 (R77). Non-critical override requires audited reason.  
- Job `product_domain` must match exam domain.  
- RCIC profile cannot target `lms_exams`. Citizenship/language profiles cannot target `academy_exams`.  
- Locale switch does not bypass entitlement.  
- Manus/OpenAI cannot call publish APIs.  
- Manus cannot write Exam Master or mark sources authoritative.  
- Unverified / leaked exam material cannot enter the authoritative pack or question bank.  
- Mock/practice pool is course-pivot + exam scoped.  
- Question selection is server-only; no keys while in progress.  
- Snapshot and option order immutable after start.  
- Course A entitlement cannot start Course B mocks.  
- Pass 3 validator never receives generated `is_correct`.  
- No UI copy claiming 100% AI accuracy.

---

## 17. Migrations (additive only)

| DB | Change |
|----|--------|
| `db_academy` | `academy_exams` + translations + sources; **`academy_exam_evidence_packs` + `academy_exam_evidence_items`**; Exam Master field-change audit; structure `admin_asserted` fields; `next_review_at` / `stale_reason`; separate `manus_research_json` / `openai_verification_json`; `academy_courses.exam_id`; commerce/i18n/preview; questions `exam_id` + generation provenance; `academy_course_questions` pivot; template `exam_id`/`course_id`/`selection_mode`/mix/review flags; attempt snapshot stores option order + case_version_id + `submission_reason`; AI job exam/profile/evidence-pack fields |
| `db_lms` | `lms_exams` + sources; **`lms_exam_evidence_packs` + items**; Exam Master audit; course commerce/exam_id; versioned exam questions + provenance + course pivot; `lms_exam_templates` + attempts with snapshot/timer; LMS review statuses; `lms_ai_*`; assignment entitlement columns |
| `db_cws` | `learning_course_payments`; existing `users.locale` |

No `migrate:fresh`.

---

## 18. API sketch (additive)

**Locale:** `PATCH /api/v1/me/locale`

**Admin exams:**  
`/api/v1/admin/learning/exams` (query `product_domain`)  
CRUD, sources, verify, list courses, question bank, mock templates,  
`POST .../exams/{exam}/research` (Refresh Exam Research),  
`POST .../exams/{exam}/evidence-pack/approve`,  
evidence-item add/disable/verify/resolve-conflict, snapshot view,  
`POST .../exams/{exam}/generate-course` (R77 gate)

**Learner mocks:** existing Academy attempt routes **extended** (scoped pool, frozen options, results payload). New LMS exam-master attempt routes with the same semantics.

**Catalog / checkout / my-learning:** as previous draft.

**AI Studio:** existing Academy AI routes plus LMS AI routes under `/api/v1/admin/lms/ai/*` (or `/admin/learning/ai/*` with domain). Job body includes `exam_id`. Product selector in UI.

**Catalog / checkout / my-learning:** as previous draft.

---

## 19. Test matrix

### Marketplace / commerce / i18n (previous 1–40, still required)

Consultant vs client catalogs; no cross-domain leakage; EN/FR cards + fallback; locale persistence; staff own locale; content language ≠ UI; filters; admin metadata; translation outdated flag; manual create; thumbnail/price/duration; CTAs; purchase isolation; preview vs paid; Stripe domain isolation; refund/expiry; citizenship LMS path; IELTS assign; pathway 403; Academy / AI Studio / billing / wallet / team / case-journey regressions.

Also: missing `type=learning_course` must not grant a course or a platform sub.

### Exam Master + hybrid AI (new)

1. Admin can create Exam Master.  
2. Exam supports RCIC Academy domain.  
3. Exam supports Client LMS domain.  
4. Exam metadata EN/FR (+ fallback).  
5. Exam can have an authoritative **Evidence Pack** (not just a URL list).  
6. Generate Course action requires `exam_id` **and** verified minimum evidence (R77).  
7. AI job receives correct `exam_id` **and** verified Evidence Pack.  
8. Manus research uses selected exam + **profile** source policy; output stays `ResearchNotes`.  
9. OpenAI generation receives verified snapshots only.  
10. RCIC profile generates **Academy** drafts only.  
11. Citizenship profile generates **LMS** drafts only.  
12. Language profile does **not** load RCIC legal prompts.  
13. Generated course remains `draft`.  
14. Generated practice questions link to the correct course.  
15. Generated mock template links to the correct exam + course.  
16. Publishing a course makes it catalog-eligible in the matching marketplace.  
17. Academy generation never writes `db_lms`.  
18. LMS generation never writes `db_academy`.  
19. French generated content remains review-required.  
20. Course price / access duration remain Admin-confirmed (AI suggestion ≠ live price).  
21. Manus/OpenAI cannot publish.  
22. Existing `AcademyAiContentTest` stays green.  
23. Academy exam sitting security (key strip, **frozen snapshot**, server timer) stays green.  
24. Client LMS assignment + pathway flow stays green.  

### Exam bank / random mocks / admin edit (mandatory)

1. Exam has its own question bank.  
2. Course attaches only to that exam’s bank.  
3. Mock uses eligible (course + mock_eligible + published) questions only.  
4. Random attempts A and B can differ when the pool allows.  
5. Attempt snapshot unchanged after refresh.  
6. Question versions frozen per attempt.  
7. Option order frozen per attempt.  
8. `fixed_form` serves the configured set.  
9. `random_pool` draws from the pool.  
10. Recent-question avoidance preferred when pool allows.  
11. Small pool still starts (repeats allowed).  
12. Server timer starts once.  
13. Refresh does not reset timer.  
14. Local clock cannot extend `expires_at`.  
15. Expired answer write rejected.  
16. Expired attempt auto-finalizes.  
17. Duplicate submit does not double-score.  
18. Result score correct.  
19. Unanswered count correct.  
20. Time-used calculation correct.  
21. Topic analytics correct (or omitted if no topics).  
22. Competency analytics correct (or omitted).  
23. Independent vs case analytics correct.  
24. Answer keys hidden before submit.  
25. Answer review only after submit when allowed.  
26. Course A purchase cannot access Course B mock.  
27. Admin can manually edit a generated lesson.  
28. Admin can manually edit a generated question.  
29. Admin can change mock configuration before publish.  
30. Admin can create a question without AI.  
31. Admin can create a mock template without AI.  
32. Regeneration creates a safe draft/version.  
33. Historical attempt unchanged after admin edit.  
34. Academy regression.  
35. Client LMS regression.  
36. AI Content Studio regression.  
37. Stripe commerce regression.  
38. Team/staff regression.  
39. Case journey regression.  

### Exam Evidence Research Pack (R80 — mandatory)

1. Exam Evidence Pack is created before full generation.  
2. Official source is classified correctly (priority R62).  
3. Unverified past paper cannot become authoritative (`unverified_exam_material`).  
4. Public official sample paper may be analyzed (pattern metadata only).  
5. Source snapshot hash is stored.  
6. Conflicting official exam structure blocks generation (`exam_source_conflict`).  
7. Newer official source can resolve a stale source.  
8. Manus research output does **not** directly alter Exam Master.  
9. OpenAI cross-check records disagreement with Manus.  
10. Blueprint requires verified evidence (rejects memory-only structure).  
11. Lesson claim provenance is stored.  
12. MCQ provenance is stored (R72).  
13. Validator does **not** see the generated correct answer (Pass 3).  
14. Low exam relevance is flagged (`low_exam_relevance`).  
15. Style mismatch is flagged (`style_mismatch`).  
16. Past-paper near-copy is flagged.  
17. Course coverage gap is detected (`coverage_gap`).  
18. Mock bank insufficiency is detected (`Insufficient Question Pool`).  
19. Exam evidence refresh does **not** silently overwrite approved Exam Master data.  
20. Admin override of a non-critical warning is audited.  
21. AI still cannot publish.  
22. Existing Exam Bank / random Mock tests remain green.  
23. Academy regressions remain green.  
24. Client LMS regressions remain green.  
25. Admin-entered structure without official evidence does **not** become `verified` (`admin_asserted` only).  
26. Model agreement without an official supporting source is **not** `verified`.  
27. A new official version makes an existing pack stale **immediately**.  
28. Source hash change triggers review (`source_content_changed`).  
29. Profile-specific `next_review_at` works.  
30. `robots.txt` permission alone does **not** classify a file as reusable.  
31. Restricted/unknown material is **not** permanently mirrored as a full source file.  
32. Official allowed material can be snapshotted when reuse is permitted.  
33. Critical stale evidence blocks affected full generation.  
34. Evidence Summary accurately reflects verification states.  

### Frontend

Udemy-style grid; locale toggle; localized CTA; filter bar; detail + purchase panel; My Learning; Exams admin; **Research / Evidence** panel; **Evidence Summary** gate; Question Bank admin; Mock template admin; **mock player**; **result dashboard**; AI wizard starting from exam **after** Evidence Pack approval; inspectable evidence lineage (R85).

PHPUnit: `db_academy_test` / `db_lms_test` only. Refuse wiping product DBs.

---

## 20. Phases

### Phase 0 — inspect

Complete (this document).

### Phase 1 — shared marketplace / i18n

DTOs, dictionaries, `PATCH /me/locale`, LocaleToggle, catalog API skeletons.

### Phase 2 — Exam Master + metadata/sources + **exam question bank schema** + Evidence Pack tables

`academy_exams` / `lms_exams`, translations, sources, **evidence packs + items**, Exam Master audit log, `exam_id` on courses, question `exam_id`, course-question pivot, template `exam_id`/`course_id`/`selection_mode`.

### Phase 3 — RCIC Academy catalog UI

CourseCard grid, filters (including exam), detail, statuses from existing entitlements.

### Phase 4 — Client LMS catalog UI

Client marketplace sections; default `access_mode=consultant_assigned`.

### Phase 5 — Admin exam / course / **question bank / mock template** management

Commerce fields, EN/FR preview, attach exam, **Research / Evidence UI**, manual create course/question/mock **without AI**, eligibility flags, bank stats UI, coverage / insufficient-pool surfaces.

### Phase 6 — commerce / entitlement

`learning_course_payments`, Checkout, webhook routing, purchase/expiry/renew/refund. AI does not set live prices. Course-scoped mock/practice authorization.

### Phase 7 — preview + My Learning + **mock player / results**

`is_preview`, My Learning buckets, professional mock UI, server timer display, result dashboard, post-submit review. Extend Academy sitting engine: scoped pool, frozen option order, mixes, recent-avoidance, idempotent expiry.

### Phase 8A — French localization / translation workflow

Metadata statuses, `translation_outdated`, language review.

### Phase 8B — AI Studio exam-driven generation (Academy)

**Evidence Pack first:** research → verify → snapshot → classify → Admin approve. Then require `exam_id`, inherit exam + verified pack, `rcic_exam_prep`, evidence-grounded blueprint/lessons/MCQs, eight-pass validation, coverage report, import into **exam bank + course pivot + random_pool template**. Granular regenerate → new drafts. Existing Academy AI tests remain green. Manus still cannot write Exam Master.

### Phase 8C — Client LMS generation profiles + importer

`lms_ai_*`, `citizenship_exam_prep` + `language_exam_prep`, LMS Evidence Packs, `LmsAiDraftImporter`, LMS exam bank + sitting semantics for new mocks, LMS draft review statuses. Shared Manus/OpenAI clients. No writes to `db_academy`.

### Phase 9 — full verification

`VERIFICATION.md`. No production deploy. No `migrate:fresh`.

---

## 21. Risks

| Risk | Mitigation |
|------|------------|
| Learning Checkout → platform sub | Fail closed on `type`; tests |
| Exam Master overloaded onto `academy_exam_templates` | Separate tables (R26) |
| RCIC prompts used for IELTS | Profile isolation tests (new #12) |
| LMS drafts land in Academy | Separate importers + write tests (#17–18) |
| AI sets live CAD prices | R37; commerce columns unchanged until Admin confirm |
| Language exams assumed MCQ-only | `exam_format_json.sections` + O13 |
| Catalog listing drift | Derived from published courses (R36) |
| Global Academy question sample leaks Course B into Course A mock | Replace `publishedOfType()` with exam+course+eligibility pool (R41–R44) |
| Option shuffle on refresh | Snapshot option ids at start (R46); stop shuffling in `show()` |
| AI locks drafts | R54–R55; tests 27–33 |
| AI “100% accurate” claims | Forbidden copy (R79); statuses are Verified / Review Required / Source Conflict / Citation Unverified / Outdated / Coverage Gap |
| Memory-only course structure | Blueprint requires verified Evidence Pack (R70) |
| Leaked / dump papers ingested | `unverified_exam_material`; never authoritative (R63) |
| Silent source conflict | `exam_source_conflict` blocks material generation (R66) |
| Stale exam format used for mocks | Currency check + `exam_reverification_required` (R67, O23) |
| Manus writes Exam Master | ResearchNotes only; tests R80.8 |
| One research provider overwrites the other | OpenAI cross-check flags disagreement (R69) |
| Incomplete course marked ready | Coverage report + `coverage_gap` (R74) |
| Thin mock pool published | `Insufficient Question Pool` (R75) |
| Model agreement treated as proof | Separate Manus/OpenAI stores; official source still required (R82) |
| Admin-entered structure marked verified | `admin_asserted` until official evidence (O22) |
| robots.txt treated as reuse licence | Retrieval ≠ storage/reuse (R86, O24) |
| Fake “AI accuracy %” | Forbidden unless measured test set (R79) |

---

## 22. Explicit non-goals

- Merging `db_academy` and `db_lms` learner or question data  
- Udemy branding / pixel-perfect clone  
- Fake ratings or fake popularity  
- Public unauthenticated SEO course pages  
- AI auto-publish (including French legal content)  
- **“100% AI accuracy” / “guaranteed correct” product claims**  
- Changing Maple, case journey, referral wallet, or platform subscription SKU  
- Gifting a course to another user  
- `/en/` `/fr/` route trees  
- **Replaced:** “Client LMS AI course factory is out of scope.” It **is in scope** via 8C.  
- **Added:** synthetic listening audio and automated speaking assessment may wait; schema must not block them  

AI generation **is** supported for RCIC Academy **and** Client LMS through **different generation profiles** and **different domain importers**.

---

## 23. Approval

**Approved 2026-09-14:**

- **R1–R80** locked (R20 remains replaced).  
- **R81–R86** locked (accuracy pipeline, research independence, past-paper pattern-only, Evidence Summary, traceability, retrieval vs reuse).  
- **O1–O21** locked as recommended.  
- **O22–O24** locked as **replaced** in §3.1–§3.3 (not the earlier recommended wording).

Implement Phase 1 → 9 (8A / 8B / 8C). No production deploy. No `migrate:fresh`. Do not merge RCIC Academy and Client LMS learner data.

Create `docs/plans/shared-learning-marketplace/VERIFICATION.md` at the end of Phase 9.
