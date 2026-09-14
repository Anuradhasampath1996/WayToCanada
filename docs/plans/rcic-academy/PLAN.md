# RCIC Academy — Professional Learning & Exam Preparation

**Status:** decisions locked 2026-09-14 — implementation in approved phase order.  
**Date:** 2026-09-14  
**Working name:** RCIC Academy  
**Positioning:** RCIC Professional Learning & Exam Preparation  
**Exam-prep wording:** Independent RCIC Exam Preparation Program  

**Out of scope until a later approved plan:** production deploy, `migrate:fresh`, RCIC case-handling Phase 0–6 workflow or frozen tag `rc-case-handling-phase-0-6`, AI Tutor implementation, full case simulations, hearing practice, written-submission grading, flashcards/spaced repetition product UI, CPD Tracker product UI, certificates product UI, CICC-approved marketing claims.

This plan is based on inspection of the current codebase. There is **no** RCIC professional LMS today. The existing LMS is a **client exam-prep** product (IELTS / CELPIP / PTE / NCLEX / TEF) gated by immigration pathway.

Do **not** describe this product as an official CICC exam course, CICC-approved exam prep, official exam questions, or a guaranteed pass unless written approval exists.

---

## Implementation gate

1. Approve or rewrite the **Recommended locked decisions** and **Open decisions** below.
2. Then implement Phase 0 → 9 in order.
3. No production deploy from this plan.
4. No `migrate:fresh` on product/production `db_cws` (or any live Academy / LMS database).
5. Do not modify Phase 0–6 case-handling workflow or the frozen tag `rc-case-handling-phase-0-6`.
6. Do not merge Academy data into the client LMS. Do not change client LMS scoring, pathway gate, or assignment APIs except to keep them passing.
7. Do not break hardened platform billing, referral/wallet, team/staff access, or client portal.

Do **not** start Phase 1 until this plan is approved.

After implementation: create `docs/plans/rcic-academy/VERIFICATION.md` — written 2026-09-14. Not deployed.

---

## Product goal (locked by this request)

Build an independent professional learning and exam-preparation area inside RCICMaster for:

- licensed RCIC consultants
- RCICs preparing for specialization exams
- future RCIC candidates where a later product explicitly allows it
- ongoing professional learning / CPD support (schema + later phases)

v1 priority track: **RCIC-IRB Specialization Exam Preparation** (Independent program).

The architecture must support later tracks without hardcoding IRB:

- RCIC Entry-to-Practice Exam preparation
- CPD courses
- professional practice courses
- mentoring preparation/support
- legislation update courses

---

## 0. Current architecture findings

### 0.1 Existing client LMS (do not merge)

| Item | Finding |
|------|---------|
| Database | Separate Postgres `db_lms`, Laravel connection `lms`. Users live on `db_cws`. Assignment rows store `client_user_id` / `assigned_by_user_id` **without FK**. |
| Migrations | `backend/database/migrations/2026_06_11_200000_create_lms_tables.php`, `2026_06_11_210000_lms_advanced_features.php` |
| Tables | `lms_categories`, `lms_courses`, `lms_modules`, `lms_lessons`, `lms_quizzes`, `lms_questions`, `lms_question_options`, `lms_question_bank`, `lms_question_bank_options`, `lms_quiz_bank_questions`, `lms_course_assignments`, `lms_lesson_completions`, `lms_quiz_attempts`, `lms_homework`, `lms_homework_submissions` |
| Audience | Immigration **clients** only. Categories seeded as IELTS, CELPIP, PTE, NCLEX, TEF. |
| Entitlement | Consultant assigns a published course to a client. Unique `(course_id, client_user_id)`. |
| Gate | `LmsPathwayGate` — client API requires `case_files.immigration_pathway`. Frontend `canAccessLearning()`. |
| Question types | Single-correct MCQ only. One `is_correct` option. |
| Question bank | **Per course**, not central. Fields: `question_text`, `topic` (string), `difficulty`, `explanation`. No competency, division, citations, reviewer, effective dates, or version rows. |
| Exam engine | `LmsExamService` — `inline` / `bank_fixed` / `bank_random`. Labels `quiz` / `exam` / `mock_exam` are UI-only. Same scoring path. |
| Answer security | `clientQuestionsPayload()` strips `_correct_option_id` before submit. Snapshot stored on attempt for review. **Reuse this pattern, not the tables.** |
| Timer | `time_limit_minutes` exists. Client countdown only. **No server expiry / auto-submit.** |
| Versioning | **None.** Editing a bank question changes meaning for future (and conceptually historical) use. Snapshot on attempt is the only freeze. |
| Review workflow | `lms_courses.is_published` boolean only. No legal review, no draft→approved states. |
| Progress | Lesson completions only. Quizzes/homework do not gate course completion. |
| Certificates / CPD / flashcards | **Do not exist.** |
| Analytics | No LMS analytics API. Consultant sees assignment `%` + quiz scores on the client workspace card. |
| Tests | **No dedicated LMS feature tests.** `RefreshesLmsDatabase` wipes `lms` for other suites. |
| Staff | Team key `lms.view` is **client-workspace LMS assign/track**, default off. Not a consultant learning permission. |

**APIs today**

| Actor | Prefix |
|-------|--------|
| Client | `/api/v1/client/lms/*` — `ClientLmsController` |
| Consultant | `/api/v1/consultant/clients/{profile}/lms*`, `GET /api/v1/consultant/lms/courses` — `ConsultantLmsController` |
| Admin | `/api/v1/admin/lms/*` — `AdminLmsController` |

**Frontends today**

| App | Path | Role |
|-----|------|------|
| Public users Dashboard | `/user-dashboard/learning` | Real client player |
| Consultant Dashboard | `/dashboard/clients/[id]/workspace/lms` | Assign / unassign / view client progress |
| Admins Dashboard | `/admindashboard/lms` | Client-LMS CMS (categories, builder, bank, homework) |
| Consultant Website | marketing copy only | No LMS routes |
| Public / Demo dashboards | `/dashboard/academy`, `/dashboard/(auth)/apps/courses` | **Shadcn templates, not wired** |

### 0.2 What can be reused (patterns only)

| Pattern | Source | Academy use |
|---------|--------|-------------|
| Strip answer keys until submit | `LmsExamService::clientQuestionsPayload` | New `AcademyExamService` (do not call LMS models) |
| Attempt snapshot | `lms_quiz_attempts.questions_snapshot_json` | Stronger: store `question_version_id` per answer **and** a session snapshot |
| TipTap lesson editor | Admin `lms-course-builder.tsx` | New Academy builder; do not share the same page |
| Notifications | `NotificationType` + `NotificationService` + `dedupe_key` | New `academy_*` types, category `academy` |
| Team ACL | `config/team.php` assignable keys | New `academy.learn` (do **not** reuse `lms.view`) |
| Subscription inherit | `TeamAccess::entitlementUser()` / staff lock | Staff Academy still requires `academy.learn`; owner sub inactive still locks staff workspace |
| Add-on commerce | `storage_addon_packages` / marketing services | Schema-ready Academy add-on later; **not v1 checkout** |
| Maple boundaries | `MapleAiBoundaries`, source-grounded prompts | Design-only for a later AI Tutor plan |

### 0.3 What must stay separate

| Concern | Client LMS | RCIC Academy |
|---------|------------|--------------|
| Audience | Clients on a visa file | Consultants / staff learners / future candidates |
| Entitlement | Consultant assignment + pathway | Platform subscription / grant / future purchase |
| Question difficulty | Language / skills exams | Professional / tribunal / ethics |
| Exam engine | Short quiz, no server timer | Configurable mock (IRB 190 / 4h as a **template**) |
| Legal versioning | None | Required |
| Analytics | Per-assignment progress | Topic / competency / readiness |
| Staff key | `lms.view` = manage client courses | `academy.learn` = take Academy courses |

### 0.4 Consultant dashboard / auth / staff

| Item | Finding |
|------|---------|
| Identity | `users` on `cws`. Spatie roles: `super-admin`, `admin`, `rcic`, `client`, `staff` (guard `sanctum`). |
| Login | One `POST /api/v1/auth/login`. Frontends reject wrong role. |
| Owner vs staff | `TeamAccess`. Owner = `rcic` whose `id` is `consultant_workspaces.owner_user_id`. Staff never get `rcic`. |
| `GET /me` | `user.team` with `actor_type`, `permissions`, `owner_only`. |
| Subscription | `consultant_subscriptions` per owner `user_id`. Staff inherit for access; `can_checkout: false`. UI `SubscriptionGuard`. Workspace APIs still do not globally enforce owner subscription (staff inherit-check only). |
| Add-ons today | Storage + marketing only. **No Academy SKU.** |
| Consultant nav | Overview (Dashboard, Legislations Hub, Letters), Client Work, Marketing, Community. **No Academy nav.** LMS is buried under client workspace. |
| Staff extra modules | `letters.use`, `legislations.view`, `community.view`, `storage.*`, `marketing.view`, `lms.view` — assignable, default off. |

### 0.5 Admin

| Item | Finding |
|------|---------|
| App | `frontend/Admins Dashbord` — `/admindashboard/*` |
| Permission | Coarse `role:super-admin,admin` on `/api/v1/admin/*`. No fine-grained admin ACL. |
| LMS admin | One screen `/admindashboard/lms` under Platform. Must remain the **client** LMS. |
| Analytics home | User counts + subscription revenue. No learning metrics. |

### 0.6 Legislation Hub (not Academy)

Consultant **Legislations Hub** is a live IRPA/IRPR research product on `db_cws` (`legislation_documents`, provisions, catalog, sync, bookmarks). Admin syncs Justice Canada. This is **not** a study CMS and must not be rebranded as Academy.

Academy needs its own **curated legal source records** (summary, key points, last verified, linked lessons/questions). Those records may *link* to a `legislation_documents.id` or official URL. Summaries must never be presented as official law.

Connection `legal` / `db_legal` exists in `config/database.php` but legislation models use `cws`. **Do not put Academy on `db_legal`.**

### 0.7 Notifications / storage / AI

| Area | Finding |
|------|---------|
| Notifications | `user_notifications` + in_app / email / WhatsApp. LMS types: `course_assigned` (client), `lms_completed` (consultant). |
| Media | LMS lessons store **URL strings** (`video_url`, `pdf_url`). Only thumbnails upload to `public` disk `lms-thumbnails/`. Case documents use `ClientDocumentStorage` (localstack/local). |
| Maple | Decision support only. Forbidden: final pathway, approve info/docs, sign, submit, final eligibility. No invented IRPA cites. |

### 0.8 Referral / wallet / case journey

Leave untouched. Academy must not write wallet ledgers, change Stripe fulfillment, or alter Phase 0–6 state machines. Regression tests from those modules must keep passing.

---

## 1. Reuse vs separate-module decision

**Recommendation: B — separate Academy module, sharing selected patterns only.**

| Option | Verdict |
|--------|---------|
| **A. Extend existing LMS** with an “academy domain” flag | Reject. `lms_*` is client-assigned, pathway-gated, per-course bank, no versions, no competencies, no citations, no server exam timer, no review workflow. Extending it would couple visa-client progress to professional exam prep and risk `RefreshesLmsDatabase` / client player regressions. |
| **B. Separate Academy module** | **Accept.** New `academy_*` tables, services, APIs, consultant + admin UIs. Reuse exam-payload, notification, team-permission, and TipTap *patterns*. |

Do not share `lms_courses`, `lms_question_bank`, or `lms_quiz_attempts` rows with Academy learners.

---

## 2. Positioning and copy (locked)

| Use | Copy |
|-----|------|
| Module name | **RCIC Academy** |
| Subtitle | RCIC Professional Learning & Exam Preparation |
| IRB product | Independent RCIC Exam Preparation Program |
| Score label | **Exam Readiness Score** (not official pass prediction) |
| Legal summaries | Study aid — verify the official source |
| AI (later) | Support only — not legal advice, not an official answer |
| CPD (later) | `officially_approved_cpd = false` unless verified approval evidence exists |

Forbidden unless written approval exists: “official CICC exam course”, “CICC-approved”, “official exam questions”, “guaranteed pass”.

---

## 3. Learning tracks

Admin-managed `academy_learning_tracks`. Seed v1:

| key | name |
|-----|------|
| `irb_specialization` | RCIC-IRB Specialization Exam Preparation |
| `entry_to_practice` | RCIC Entry-to-Practice Exam Preparation (inactive until content exists) |
| `cpd` | Continuing Professional Development |
| `professional_practice` | Professional Practice |
| `mentoring` | Mentoring Preparation |
| `legislation_update` | Legislation Updates |

IRB subject areas are **topics**, not tracks. Engine code keys off `track_id` / topic keys, never a hardcoded “IRB-only” exam class.

---

## 4. Consultant navigation

New top-level group **RCIC Academy** in Consultant Dashboard (`nav-main.tsx`), sibling of Overview / Client Work — not under a client workspace.

Base path: `/dashboard/academy`

| Nav item | Href | v1 | Later |
|----------|------|----|-------|
| Dashboard | `/dashboard/academy` | yes | |
| My Learning | `/dashboard/academy/learning` | yes | |
| Exam Preparation | `/dashboard/academy/exam-prep` | yes | |
| Courses | `/dashboard/academy/courses` | yes | |
| Question Bank | `/dashboard/academy/practice` | yes (practice entry) | admin bank stays in Admin |
| Mock Exams | `/dashboard/academy/exams` | yes | |
| Case Simulations | `/dashboard/academy/simulations` | hidden | Phase 2 |
| Study Planner | `/dashboard/academy/planner` | yes | |
| Flashcards | `/dashboard/academy/flashcards` | hidden | Phase 2 |
| Legislation Hub | `/dashboard/academy/sources` | yes (Academy study sources) | |
| My Notes | `/dashboard/academy/notes` | yes | |
| Performance | `/dashboard/academy/performance` | yes | |
| CPD Tracker | `/dashboard/academy/cpd` | hidden | Phase 2 |

Staff: hide the whole group unless `academy.learn`. Backend still enforces.

Do not add Academy routes to the client portal or public website in v1.

---

## 5. Learner dashboard (v1)

`GET /api/v1/consultant/academy/dashboard`

Cards:

- Active course + completion %
- Exam Readiness %
- Questions attempted
- Independent MCQ accuracy
- Case-based accuracy
- Mock exam average
- Study streak (consecutive days with any scored attempt)
- Study hours (sum of recorded time)
- Weak topics (lowest topic accuracy, min sample)
- Upcoming exam date (from study plan)

**Today** recommendations (rule-based, transparent):

1. Next incomplete lesson in the active course (or a weak-topic lesson)
2. A small weak-topic MCQ set (default 20)
3. One published case scenario in a weak topic

**Exam Readiness Score (v1, documented in UI):**

```
readiness = round(
  0.25 * course_completion
+ 0.25 * independent_mcq_accuracy
+ 0.25 * case_based_accuracy
+ 0.25 * latest_or_average_mock
)
```

If a component has no data, redistribute remaining weight equally among components that have data. Never call this an official CICC pass prediction. Weights live in `config/academy.php` so they can change without a schema rewrite.

---

## 6. Course model

```
Course → CourseVersion → Module → Lesson
```

Published meaning is frozen on a **version**. Editing a published course creates or updates a **draft version**. Publishing the draft does not mutate the previously published version. Learner progress attaches to `course_id` + last completed `course_version_id` (continue on newest published unless the learner is mid-version; see O9).

### 6.1 Lesson types (enum)

v1 render: `rich_text`, `video`, `audio`, `pdf`, `download`, `external_link`, `legislation`, `quiz` (embedded practice set), `mcq_set`, `case_question`, `checklist`.

Schema-ready, UI later: `assignment`, `written_response`, `flashcards`.

Media v1: URL + optional upload to `local` disk `academy/` (not client document S3). Thumbnails on `public` disk `academy-thumbnails/`. No SCORM.

### 6.2 Course fields

`title`, `slug`, `description`, `thumbnail_url`, `track_id`, `category` (admin string or topic), `difficulty` (`foundation` / `intermediate` / `advanced`), `estimated_hours`, `access_tier` (`subscription` / `free` / `grant_required`), workflow `status`, `current_published_version_id`, `last_reviewed_at`, `legal_reviewer_user_id`, `created_by`.

Version fields: `version_number`, `effective_from`, `effective_to`, `change_notes`, `source_references` (via `academy_content_source_links`).

---

## 7. Question bank

Central bank (not per-course). A question may be linked to many courses/lessons/exams via join tables.

### 7.1 Types

| v1 | Future (enum reserved) |
|----|------------------------|
| `independent_mcq` | `multi_select`, `true_false`, `written_response`, `short_answer`, `matching`, `hearing_prompt` |
| `case_mcq` | |

MCQ: 4+ options when configured (min 2). Exactly one `is_correct` in v1.

Each **published version** stores: question text, options, correct key, overall explanation, per-incorrect-option explanation, topic(s), division (via topics), competency(ies), difficulty, citations, `last_verified_at`, `effective_from` / `effective_to`, author, reviewer, status.

### 7.2 Case-based

Reusable `academy_cases` + `academy_case_versions`:

- client profile JSON
- immigration history
- facts
- procedural history
- tribunal information
- legal issues
- exhibits (BOC, passport, police report, country evidence, witness statement, …)

Then attach many questions (`academy_case_questions`). **Do not duplicate case text on every MCQ.**

Learner flow v1: read case + exhibits → answer related MCQs. Analysis / written / hearing exercises are Phase 2.

---

## 8. Topics and competencies

Admin CRUD. Many-to-many on lesson versions, question versions, and (via those questions) mock items.

**Seed IRB topics (editable, not hardcoded in engine):**

IRB Foundations, ID, IAD, RPD, RAD, Ethics, Professional Responsibility, IRPA, IRPR, Evidence, Administrative Law, Procedural Fairness, Hearing Preparation, Legal Research, Written Submissions.

Optional `division` on topic: `id`, `iad`, `rpd`, `rad`, `irb`, `ethics`, `other`.

**Seed competencies:**

Canadian legal framework, immigration legislation, legal research, issue identification, evidence analysis, tribunal process, hearing preparation, written advocacy, oral advocacy, professional judgment, ethics, client communication.

---

## 9. Practice mode (v1)

`POST /api/v1/consultant/academy/practice/sessions`

Learner selects count: 10 / 25 / 50 / custom (max in config, default 100).

Filters: topic, division, competency, difficulty, `independent_mcq` / `case_mcq`, incorrect only, unanswered, bookmarked, weak topics (system-defined: accuracy below threshold with min attempts).

Modes: `explain_immediately` | `explain_after_set`.

UX: next/previous, bookmark, report, personal note, optional confidence (`low` / `medium` / `high`).

API never sends `is_correct` / correct option / explanations until the question is answered (immediate mode) or the session is completed (after-set mode).

---

## 10. Mock exam engine (v1, high priority)

Admin-driven **exam templates**. Do not hardcode 190 / 4 hours in PHP.

Seed one published template for IRB prep:

| Field | Seeded value |
|-------|----------------|
| name | Independent IRB Specialization Readiness Mock |
| total_questions | 190 |
| duration | 240 minutes |
| mix | 95 independent + 95 case-based |
| topic mix | configurable JSON (even across seeded IRB topics if enough items exist) |
| randomization | questions yes; options optional |
| navigation | allowed |
| review before submit | allowed |
| explanations during exam | **never** |
| pass / readiness thresholds | admin percents (labels: readiness, not official pass) |
| max attempts | nullable (unlimited if null) |

**During exam**

- timer from server `expires_at`
- question number, navigator, unanswered, flag
- save progress (`PUT` answers)
- no correctness, no explanations
- learner-safe payload only
- auto-submit when `now >= expires_at` (on heartbeat / next write / scheduled job)
- confirm before manual submit
- one in-progress attempt per template per user

**After submit**

- total, independent, case-based, topic, competency scores
- time analysis
- incorrect list + explanations + citations
- recommended study topics
- Exam Readiness Score (dashboard formula, plus this mock as the mock component)

Historical attempts keep the **question version ids** served at start. Editing a question later must not change that attempt’s score.

---

## 11. Case simulation / hearing / written work

| Feature | v1 | Later |
|---------|----|--------|
| Reusable cases + case-based MCQs | yes | |
| Interactive simulation (intake → strategy → write-up) | no | Phase 2 plan |
| Hearing practice (opening, exam, objections, closing) | no | Phase 2 plan |
| Written submissions + rubric + instructor score | no | Phase 2 plan (schema not created in v1) |

v1 is useful without AI, simulations, or grading workflows.

---

## 12. Academy legislation study hub

New screens at `/dashboard/academy/sources` and Admin → Legal Sources.

Each `academy_legal_sources` row: title, organization, URL, type, citation label, effective date, last verified, version, status, summary, key points, optional `legislation_document_id` (cws, no FK).

Features v1: list/search, summary + official link disclaimer, linked lessons/questions/cases, personal notes/bookmarks.

Do **not** auto-sync Justice Canada into Academy summaries. Do **not** treat Maple/AI as a rewriter when a source is outdated.

Existing consultant `/dashboard/legislations` stays the research hub.

---

## 13. Citations, versioning, review, outdated queue

### 13.1 Citations

Question explanations show source title, section/rule, URL, last verified. Admin flags: `needs_legal_review`, `source_outdated`, `source_changed`, plus archive.

### 13.2 Workflow

```
draft → content_review → legal_review → approved → published → archived
```

Important exam-prep questions, cases, and courses **cannot** jump from author to published. Admin override allowed with `academy_content_reviews` audit (`from_status`, `to_status`, actor, comment).

Store `created_by`, `reviewed_by`, `approved_by`, `reviewed_at`, `approved_at` on the version row.

### 13.3 Outdated Content Queue

When a legal source is marked outdated / version-changed, insert `academy_outdated_flags` for every linked lesson version, question version, case version, and exam template that references it.

Admin actions: Review, Update (new content version), Archive, Re-verify. **No AI auto-rewrite.**

---

## 14. Study planner (v1, rule-based)

Learner sets: track / target exam template, exam date, weekly hours, preferred days.

Server builds weeks from remaining days and seeded topic order for the track (IRB example: Foundations → ID → IAD → RPD → RAD → mixed cases → mocks → final review). Track planned vs completed minutes from lesson completions + scored attempts.

Not adaptive ML. Adaptive recommendations are Phase 2.

---

## 15. Bookmarks, notes, reports

Private to `user_id`. Polymorphic: lesson, question, case, legal source.

Question report reasons: unclear wording, possible wrong answer, outdated law, broken source, typo, duplicate. Opens admin queue. Does **not** change scores.

---

## 16. Analytics

**Learner (own data only):** attempts, correct/incorrect, independent vs case-based, topic, competency, difficulty, average time, mock trend, weak/strong areas, study hours, course completion, streak, bookmarks, repeat incorrects.

**Admin (aggregates only):** question accuracy, observed difficulty, simple discrimination (top vs bottom quartile among learners with enough attempts), commonly missed, reported, outdated, completion rates, mock completion, engagement.

Never expose learner A’s attempts to learner B. Admin may inspect a named learner in a Learner detail screen (admin-only).

---

## 17. Entitlement model

### v1 (simple)

A learner may open published Academy content when **all** are true:

1. Role `rcic`, or `staff` with `academy.learn`
2. Owner workspace subscription is `trial` / `active` / `past_due` within grace — **or** an active `academy_entitlements` admin grant exists for that user
3. Course `access_tier`:
   - `free` — published + (1)
   - `subscription` — (1)+(2)
   - `grant_required` — explicit `academy_entitlements` row for that course or its track

Do **not** auto-expose every course. Unpublished / draft / archived stay hidden.

Staff progress is **always** `user_id` of the staff member. Never read or write the owner’s attempts.

Client role: 404/403 on every Academy route.

### Schema-ready (no v1 checkout UI)

`type` on entitlement: `platform_subscription` (derived, not stored per hit), `admin_grant`, `track_grant`, `course_grant`, `complimentary`. Reserved: `addon`, `one_time_purchase`, `bundle`.

A later plan can add an Academy Stripe add-on using the storage-addon pattern. Do not invent a second live platform subscription.

---

## 18. Authorization

| Actor | Rule |
|-------|------|
| Consultant owner | Academy APIs if entitled |
| Staff | `academy.learn` + entitled (inherit owner sub unless personal grant) |
| Client | blocked |
| Admin / super-admin | `/api/v1/admin/academy/*` content + aggregates; may preview learner-safe payloads; may not silently take a consultant’s exam as that consultant |
| Cross-learner | 404 on another user’s attempt / notes / planner |

Backend is authoritative. Nav hide is not security.

New assignable team key: **`academy.learn`**. Default off. All presets unchanged (off). Do not add Academy to `owner_only`. Do not reuse `lms.view`.

---

## 19. Admin CMS

New nav item **RCIC Academy** under Platform, **beside** (not inside) **LMS Management**.

Path: `/admindashboard/academy`

Sections: Dashboard, Courses, Modules/Lessons (course builder), Question Bank, Cases, Mock Exams, Exam Templates, Topics, Competencies, Legal Sources, Content Review, Outdated Content, Learners, Analytics, Settings.

v1 hide: CPD Activities, Certificates (routes reserved).

Admin permissions stay coarse `admin` / `super-admin` (same as current admin LMS).

---

## 20. AI Tutor (design only — do not implement)

Possible later name: **RCIC Academy AI Tutor**.

Allowed later actions: explain this answer from stored explanation + citations; why option C is wrong from stored option explanation; simplify a **linked** source summary; quiz from published bank; generate draft flashcards for reviewer; summarize weak areas from the learner’s own stats.

Rules (when a later plan is approved):

- source-grounded only
- cite stored sources
- no invented legal authority
- label AI-generated text
- no final legal advice
- no “official answer” / exam-leakage claims
- reuse Maple-style forbidden-action list; add `issue_official_exam_item`, `rewrite_legal_source_as_official`

v1 ships **without** AI.

---

## 21. Notifications (v1)

New `NotificationType` cases, category `academy`. Prefer in_app; email only for high-value events.

| Type | Audience |
|------|----------|
| `academy_course_unlocked` | learner |
| `academy_study_reminder` | learner (opt-in, max 1/day) |
| `academy_mock_reminder` | learner (opt-in) |
| `academy_course_completed` | learner |
| `academy_question_reported` | admin (broadcast or first admin users — same pattern as referral admin) |
| `academy_legal_review_pending` | admin |
| `academy_source_outdated` | admin |

Do not send certificate/CPD notifications until those features exist.

---

## 22. Database design

**Recommended connection:** new Laravel connection `academy` → Postgres `db_academy` on the same instance as `db_lms` / `db_cws`.

Why not `db_cws`: large versioned content must not sit on the product DB that forbids `migrate:fresh`.  
Why not `db_lms`: `RefreshesLmsDatabase` wipes the whole `lms` connection; Academy tests and client-LMS tests must not destroy each other.  
Why not `db_legal`: unused / reserved, not an LMS.

Production bootstrap must `CREATE DATABASE db_academy` the same way `deploy/remote-load-and-up.sh` creates `db_lms`. PHPUnit gets a `RefreshesAcademyDatabase` trait (`db:wipe --database=academy` only).

Cross-DB: store `user_id` integers with **no FK** to `users` (same as LMS assignments).

All models: `protected $connection = 'academy'`.

### 22.1 Tables (v1)

**Taxonomy**

`academy_learning_tracks`  
`id`, `key` unique, `name`, `description`, `sort_order`, `is_active`, timestamps

`academy_topics`  
`id`, `track_id` nullable, `parent_id` nullable, `key`, `name`, `division` nullable, `sort_order`, `is_active`, timestamps

`academy_competencies`  
`id`, `key` unique, `name`, `description`, `sort_order`, `is_active`, timestamps

**Legal sources**

`academy_legal_sources`  
`id`, `title`, `source_organization`, `source_url`, `source_type`, `citation_label`, `effective_date`, `last_verified_at`, `version_label`, `status`, `summary`, `key_points_json`, `legislation_document_id` nullable, `created_by`, `updated_by`, timestamps

`academy_content_source_links`  
`id`, `legal_source_id`, `linkable_type`, `linkable_id`, `section_label`, timestamps  
unique `(legal_source_id, linkable_type, linkable_id, section_label)`

**Courses**

`academy_courses`  
`id`, `track_id`, `title`, `slug` unique, `description`, `thumbnail_url`, `category`, `difficulty`, `estimated_hours`, `access_tier`, `status`, `current_published_version_id` nullable, `last_reviewed_at`, `legal_reviewer_user_id`, `created_by`, timestamps

`academy_course_versions`  
`id`, `course_id`, `version_number`, `title`, `description`, `estimated_hours`, `status`, `effective_from`, `effective_to`, `change_notes`, `created_by`, `reviewed_by`, `approved_by`, `reviewed_at`, `approved_at`, `published_at`, `published_by`, timestamps  
unique `(course_id, version_number)`

`academy_modules`  
`id`, `course_version_id`, `title`, `sort_order`, timestamps

`academy_lessons`  
`id`, `module_id`, `title`, `lesson_type`, `body_html`, `media_url`, `media_disk`, `duration_minutes`, `sort_order`, `quiz_spec_json` nullable, timestamps

`academy_lesson_topics` / `academy_lesson_competencies`  
`(lesson_id, topic_id)` / `(lesson_id, competency_id)`

**Questions**

`academy_questions`  
`id`, `type`, `status`, `current_published_version_id` nullable, `created_by`, timestamps

`academy_question_versions`  
`id`, `question_id`, `version_number`, `question_text`, `explanation`, `difficulty`, `case_version_id` nullable, `status`, `effective_from`, `effective_to`, `last_verified_at`, `needs_legal_review`, `source_outdated`, `source_changed`, `author_user_id`, `reviewer_user_id`, `approved_by`, `reviewed_at`, `approved_at`, `published_at`, timestamps  
unique `(question_id, version_number)`

`academy_question_options`  
`id`, `question_version_id`, `option_key`, `option_text`, `is_correct`, `incorrect_explanation`, `sort_order`

`academy_question_topics` / `academy_question_competencies`  
`(question_version_id, topic_id)` / `(question_version_id, competency_id)`

**Cases**

`academy_cases`  
`id`, `track_id` nullable, `title`, `slug` unique, `status`, `current_published_version_id` nullable, `created_by`, timestamps

`academy_case_versions`  
`id`, `case_id`, `version_number`, `client_profile_json`, `immigration_history`, `facts`, `procedural_history`, `tribunal_info`, `legal_issues_json`, `status`, review/publish columns as courses, timestamps

`academy_case_exhibits`  
`id`, `case_version_id`, `title`, `exhibit_type`, `body_html`, `file_url`, `sort_order`

`academy_case_questions`  
`case_version_id`, `question_id`, `sort_order`  
unique `(case_version_id, question_id)`

**Exams**

`academy_exam_templates`  
`id`, `track_id` nullable, `name`, `slug` unique, `description`, `total_questions`, `duration_minutes`, `independent_count`, `case_based_count`, `topic_mix_json`, `difficulty_mix_json`, `randomize_questions`, `randomize_options`, `allow_navigation`, `allow_review`, `pass_threshold_percent`, `readiness_threshold_percent`, `max_attempts` nullable, `status`, `version_number`, `created_by`, timestamps

`academy_exam_attempts`  
`id`, `user_id`, `exam_template_id`, `exam_template_version`, `started_at`, `expires_at`, `submitted_at`, `duration_seconds`, `status`, `score_percent`, `independent_score_percent`, `case_score_percent`, `topic_scores_json`, `competency_scores_json`, `time_analysis_json`, `readiness_score`, `question_set_json` (ordered `{question_id, question_version_id, case_version_id?}`), timestamps

`academy_exam_attempt_answers`  
`id`, `attempt_id`, `question_id`, `question_version_id`, `selected_option_id` nullable, `is_correct` nullable, `time_spent_seconds`, `flagged`, `answered_at`

**Practice and progress**

`academy_practice_sessions`  
`id`, `user_id`, `filters_json`, `question_count`, `explain_mode`, `status`, `started_at`, `completed_at`

`academy_question_attempts`  
`id`, `user_id`, `question_id`, `question_version_id`, `selected_option_id`, `is_correct`, `time_spent_seconds`, `mode` (`practice` / `exam` / `lesson`), `exam_attempt_id` nullable, `practice_session_id` nullable, `confidence` nullable, `attempted_at`

`academy_learning_progress`  
`id`, `user_id`, `course_id`, `course_version_id`, `status`, `completion_percent`, `last_lesson_id` nullable, `started_at`, `completed_at`  
unique `(user_id, course_id)`

`academy_lesson_completions`  
`id`, `user_id`, `lesson_id`, `course_version_id`, `completed_at`  
unique `(user_id, lesson_id, course_version_id)`

**Learner private + admin ops**

`academy_bookmarks` — `user_id`, `bookmarkable_type`, `bookmarkable_id`, timestamps; unique triple  
`academy_notes` — `user_id`, `notable_type`, `notable_id`, `body`, timestamps  
`academy_question_reports` — `user_id`, `question_id`, `question_version_id`, `reason`, `comment`, `status`, `admin_notes`, timestamps  
`academy_study_plans` — `user_id`, `track_id`, `exam_template_id` nullable, `exam_date`, `weekly_hours`, `preferred_days_json`, `generated_weeks_json`, `status`  
`academy_study_plan_items` — `plan_id`, `week_number`, `topic_id` nullable, `title`, `planned_minutes`, `completed_minutes`, `due_on`, `status`  
`academy_entitlements` — `user_id`, `type`, `course_id` nullable, `track_id` nullable, `starts_at`, `ends_at`, `is_active`, `created_by`, `notes`  
`academy_content_reviews` — `reviewable_type`, `reviewable_id`, `from_status`, `to_status`, `actor_user_id`, `comment`, `created_at`  
`academy_outdated_flags` — `legal_source_id` nullable, `linkable_type`, `linkable_id`, `reason`, `status`, `flagged_at`, `resolved_at`, `resolved_by`

### 22.2 Not created in v1

`academy_flashcard_*`, `academy_certificates`, `academy_cpd_activities`, `academy_assignments*`, `academy_simulations*`. Document in a later plan. Avoid empty unused tables.

---

## 23. API architecture

Prefix: `/api/v1/consultant/academy/*` (Sanctum + Academy authorizer).  
Admin: `/api/v1/admin/academy/*` (`role:super-admin,admin`).

No `/client/academy` routes in v1.

### 23.1 Learner

| Method | Path |
|--------|------|
| GET | `/consultant/academy/dashboard` |
| GET | `/consultant/academy/courses` |
| GET | `/consultant/academy/courses/{course}` |
| POST | `/consultant/academy/courses/{course}/lessons/{lesson}/complete` |
| GET | `/consultant/academy/lessons/{lesson}` |
| POST | `/consultant/academy/practice/sessions` |
| GET | `/consultant/academy/practice/sessions/{session}` |
| POST | `/consultant/academy/practice/sessions/{session}/answers` |
| GET | `/consultant/academy/cases/{case}` |
| GET | `/consultant/academy/exams` |
| POST | `/consultant/academy/exams/{template}/attempts` |
| GET | `/consultant/academy/exams/attempts/{attempt}` |
| PUT | `/consultant/academy/exams/attempts/{attempt}/answers` |
| POST | `/consultant/academy/exams/attempts/{attempt}/submit` |
| GET | `/consultant/academy/exams/attempts/{attempt}/results` |
| GET | `/consultant/academy/analytics` |
| GET/POST/DELETE | `/consultant/academy/bookmarks` |
| GET/POST/PUT/DELETE | `/consultant/academy/notes` |
| GET/PUT | `/consultant/academy/planner` |
| GET | `/consultant/academy/sources` |
| GET | `/consultant/academy/sources/{source}` |
| POST | `/consultant/academy/questions/{question}/report` |

### 23.2 Admin

CRUD + workflow for tracks, topics, competencies, sources, courses/versions/modules/lessons, questions/versions/options, cases/exhibits, exam templates, review actions, outdated queue, entitlements/grants, learners list + detail, aggregate analytics, settings.

Import/export CSV for question bank (like client LMS) after core CRUD works (Phase 3).

### 23.3 Payload rule

Learner-safe question: `id`, `version_id`, `type`, `question_text`, `options[{id, option_key, option_text}]`, case payload if any.  
Never: `is_correct`, `incorrect_explanation`, `explanation`, citations, reviewer comments, admin notes — until the attempt is scored.

---

## 24. Frontend apps

| App | Work |
|-----|------|
| Consultant Dashboard | Academy shell + all learner screens |
| Admins Dashboard | Academy CMS |
| Public users Dashboard | **No Academy.** Keep `/user-dashboard/learning` as client LMS |
| Consultant Website | No Academy in v1 (optional marketing blurb later, no exam claims) |
| Demo / template academy pages | Ignore |

Consultant Academy layout: secondary subnav from §4. Staff banner already exists; do not skip `SubscriptionGuard` for owners.

---

## 25. Content security

- Unpublished questions/cases/courses: learner 404
- Mock in-progress: no answer keys
- Admin notes / review comments: admin APIs only
- Randomized sessions: persist served set so submit grades the same set
- Rate-limit report + start-exam
- Prefer 404 for cross-user attempt ids (same IDOR rule as team access)

---

## 26. Test matrix

Backend PHPUnit (`tests/Feature/Academy/`, `RefreshesAcademyDatabase` + existing `RefreshDatabase` on `cws`):

1. Consultant Academy access when entitled  
2. Client blocked  
3. Staff without `academy.learn` blocked  
4. Entitled learner sees published course  
5. Non-entitled learner blocked (`grant_required` / inactive sub without grant)  
6. Draft course hidden  
7. Published course visible  
8. Historical course/question version preserved  
9. MCQ answer not exposed before submission  
10. Independent MCQ scoring  
11. Case-based MCQ scoring  
12. Duplicate exam submit rejected  
13. Practice filters  
14. Bookmarks  
15. Incorrect-question review  
16. Mock created from template  
17. Configured question mix respected  
18. Timer expiry auto-submits  
19. Exam results generated  
20. Case-based vs independent analytics  
21. Topic analytics  
22. Competency analytics  
23. Question version tied to attempt  
24. Editing question does not change historical attempt  
25. Source citation after score  
26. Unpublished source/content hidden  
27. Question report created  
28. Admin review workflow  
29. Approval required before publish  
30. Outdated source flags linked content  
31. Learner cannot read another learner’s attempts  
32. Admin aggregate analytics  
33. Staff progress separate from owner  
34. Existing client LMS regression (manual/smoke assign + existing suites that touch LMS wipe)  
35. Subscription hardening regression  
36. Referral/wallet regression  
37. Team/staff regression  
38. Case-handling / full journey regression  

Frontend Vitest:

- Academy nav visibility (`academy.learn` / owner)
- Course player complete-lesson
- Practice answer then explanation
- Mock navigator + flag
- Timer expiry copy
- Score / readiness cards
- Question review
- Analytics cards

---

## 27. Implementation phases

| Phase | Work | Starts after |
|-------|------|----------------|
| **0** | This inspection (this file) | — |
| **1** | `db_academy` connection, tracks, topics, competencies, legal sources, seed IRB taxonomy | Approval |
| **2** | Course / version / module / lesson CMS + learner progress + entitlement checks | Phase 1 |
| **3** | Question bank, versions, options, citations, cases, case-based MCQ | Phase 2 |
| **4** | Practice engine, bookmarks, notes, incorrect-review, reports | Phase 3 |
| **5** | Exam templates, attempts, server timer, snapshots, results | Phase 4 |
| **6** | Analytics, readiness dashboard, study planner | Phase 5 |
| **7** | Review workflow, outdated queue, admin override audit | Phase 6 (workflow statuses exist from 2–3; this phase completes queues) |
| **8** | Consultant + Admin UI polish, notifications, staff `academy.learn` | Phase 6–7 |
| **9** | Full matrix + `VERIFICATION.md` | Phases 1–8 |

Phase 7 can start in parallel with Phase 6 once question/course statuses exist.

**Do not implement in this plan:** AI Tutor, adaptive engine, simulations, hearing practice, written grading, flashcards SRS, CPD Tracker, certificates. Those need a separate approved “Academy Phase 2 features” plan.

Cheap enough that v1 **does** include: bookmarks, notes, reports, study planner, legislation source records, readiness formula, question reports.

---

## 28. Files likely to change (after approval — not now)

**New**

- `backend/config/academy.php`, `config/database.php` connection `academy`
- `backend/database/migrations/*_create_academy_*.php` (`Schema::connection('academy')`)
- `backend/app/Models/Academy/*`, `Services/Academy/*`, `Http/Controllers/Consultant/Academy/*`, `Admin/Academy/*`
- `backend/database/seeders/AcademyTaxonomySeeder.php` (called from Academy migration or a documented artisan command; production must not require a forgotten `db:seed`)
- `frontend/Consultant Dashbord/app/dashboard/(auth)/academy/**`
- `frontend/Admins Dashbord/app/dashboard/(auth)/admindashboard/academy/**`
- `backend/tests/Feature/Academy/*`, `tests/Concerns/RefreshesAcademyDatabase.php`
- `deploy/*` create `db_academy`
- `NotificationType` academy cases
- `config/team.php` + `team-access.ts` + Team Management extra-modules list: `academy.learn`

**Touch**

- Consultant `nav-main.tsx`, Admin `nav-main.tsx`
- `UserResource` / team session only if we expose `academy.learn` (already inside `permissions`)
- PHPUnit test `phpunit.xml` env `DB_ACADEMY_*`

**Do not touch**

- Case Phase 0–6 services / frozen tag
- Stripe fulfillment / referral qualification
- `lms_*` tables, `LmsExamService` behavior, client learning player
- Maple production prompts (until a later AI plan)

---

## 29. Risks

| Risk | Mitigation |
|------|------------|
| Merging with client LMS | Separate DB + APIs + admin nav label **RCIC Academy** vs **LMS Management** |
| Hardcoded IRB exam | Templates + seeds |
| Answer-key leak | Server-side strip; tests 9 and 18 |
| Historical score drift | Version ids + immutable published versions |
| Staff sharing owner progress | Always `auth()->id()` |
| Over-claiming CICC / official pass | Copy lock in §2; readiness label |
| AI rewriting law | Not in v1; outdated queue is human-only |
| Third Postgres database ops | Same instance; bootstrap script; wipe only `academy` in Academy tests |
| Silent `migrate:fresh` on cws | Academy migrations never use default connection |
| Content empty at launch | v1 can ship engine + admin CMS + seeds; real IRB items are content work, not blocked on schema |
| Timer only on client | Heartbeat + expiry job + submit guard |
| Using `lms.view` by mistake | New key; keep client LMS permission meaning |

---

## 30. VERIFICATION.md (after coding — not now)

Must record: files changed, migrations, APIs, admin screens, learner screens, exam engine behavior, question versioning, authorization tests, security checks, test counts, client LMS regression, case journey regression, billing regression, referral/wallet regression, team/staff regression, remaining limitations.

---

## Recommended locked decisions (approve to lock)

| # | Recommendation |
|---|----------------|
| **R1** | Separate Academy module (option B). Do not extend `lms_*` tables. |
| **R2** | New connection `academy` / database `db_academy`. |
| **R3** | Positioning and forbidden claims in §2. |
| **R4** | Tracks table; IRB is one track. Exam formats are admin templates. |
| **R5** | Seed IRB 190 / 4h / 95+95 template; do not hardcode. |
| **R6** | v1 entitlement = active owner subscription (trial/active/grace) or admin grant; per-course `access_tier`; no Academy Stripe add-on in v1. |
| **R7** | New staff permission `academy.learn`, default off. Do not reuse `lms.view`. |
| **R8** | Progress/attempts/notes are per learner `user_id`. |
| **R9** | Clients cannot access Academy. |
| **R10** | Server-side mock timer + no keys before submit. |
| **R11** | Immutable published versions; attempts store `question_version_id`. |
| **R12** | Content workflow draft → content review → legal/RCIC review → approved → published → archived. |
| **R13** | Academy legal sources are curated study records; consultant Legislation Hub stays separate. |
| **R14** | v1 = dashboard, CMS, topics/competencies, independent + case MCQ, cases, practice, mock, citations, versioning, review, analytics, bookmarks, planner, sources. |
| **R15** | No AI, simulations, hearing, written grading, flashcards UI, CPD UI, certificates in this plan. |
| **R16** | Exam Readiness Score formula in §5; not an official pass prediction. |
| **R17** | Consultant nav group **RCIC Academy**; Admin nav **RCIC Academy** beside LMS Management. |
| **R18** | No production deploy; no `migrate:fresh`; no Phase 0–6 behavior change. |
| **R19** | Prefer 404 for cross-learner attempt/content IDOR. |
| **R20** | Production migrate creates taxonomy + IRB template (no forgotten `db:seed` required for empty structure). |

---

## Open decisions (need your approval)

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| **O1** | Module shape | A extend LMS / B separate | **B separate (R1)** |
| **O2** | Database | `db_academy` / `academy_*` on `db_lms` / tables on `db_cws` | **`db_academy` (R2)** |
| **O3** | v1 entitlement | platform sub / paid Academy add-on now / admin grant only | **platform sub + grant + access_tier (R6)** |
| **O4** | Staff key | `academy.learn` / reuse `lms.view` | **`academy.learn` (R7)** |
| **O5** | Case simulation in v1 | basic flow / MCQ-only cases | **MCQ-only cases** |
| **O6** | Written assignment tables in v1 | create unused tables / defer | **defer** |
| **O7** | Academy sources vs existing Legislation Hub | deep-link only / curated Academy sources that may link out | **curated Academy sources (R13)** |
| **O8** | Readiness weights | equal 25% / course-heavy / mock-heavy | **equal 25% four-way (§5)** |
| **O9** | Learner mid-course when a new course version publishes | stay on started version until complete / force newest | **stay on started version; offer “switch to latest”** |
| **O10** | Mock max attempts | unlimited / 3 / admin per template | **admin per template, seed unlimited (`null`)** |
| **O11** | Option shuffle | yes / no | **template flag; IRB seed on** |
| **O12** | Lesson media | URLs only / URL + upload to `local` | **URL + optional upload** |
| **O13** | Future non-RCIC candidates | v1 accounts / defer | **defer** (rcic/staff only) |
| **O14** | Enforce owner subscription on owner Academy APIs | yes (unlike most workspace APIs) / UI-only like today | **yes for Academy** — learning is a product surface, not a case file |
| **O15** | Nav placement | own group / under Overview | **own group (R17)** |
| **O16** | Question bank learner nav label | “Question Bank” vs “Practice” | **Practice** in learner app; **Question Bank** in Admin |
| **O17** | Discrimination analytics v1 | skip / simple quartile | **simple quartile when n ≥ 20** |
| **O18** | Who receives admin Academy notifications | all admins / super-admin only | **all `admin` + `super-admin` in-app** |

---

## Locked decisions (approved 2026-09-14)

R1–R20 and O1–O18 (all recommended) are locked. Do not reopen during implementation.

- Separate Academy module on `db_academy`. Do not merge with client LMS or case-management data.
- v1 entitlement = eligible platform subscription/trial/grace **or** Academy admin grant, plus per-course `access_tier`. No Academy Stripe add-on.
- Staff require `academy.learn`. Progress belongs to the staff user id. `lms.view` stays client-LMS only.
- v1 cases = reusable scenarios + case-based MCQs. Simulations, written tables, AI, flashcards UI, CPD UI, and certificates are deferred.
- Exam Readiness Score uses equal 25% weights and is never an official pass prediction.
- Learners stay pinned to the course version they started; they may explicitly switch to latest.
- Mock max attempts are per template; seeded IRB mock is unlimited. Option shuffle is a template flag (on for the seed).
- Media uses configurable `ACADEMY_MEDIA_DISK`.
- Backend Academy APIs enforce entitlement. Clients have no Academy learner APIs.
- Taxonomy + IRB exam template bootstrap is idempotent and runs with migrate (R20).

Verification file `docs/plans/rcic-academy/VERIFICATION.md` is created **after** Phase 9.
)