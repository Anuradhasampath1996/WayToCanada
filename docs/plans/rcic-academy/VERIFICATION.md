# RCIC Academy — verification

**Date:** 2026-09-14  
**Scope:** Phases 1–9 as locked in `PLAN.md` (R1–R20, O1–O18 recommended).  
**Production:** not deployed. Do not deploy from this work. Frozen tag `rc-case-handling-phase-0-6` is unchanged.

Three products remain separate:

1. RCICMaster case-management (`db_cws`)
2. Client LMS (`db_lms`)
3. RCIC Academy (`db_academy`)

Academy rows are never reused inside the client LMS. `lms.view` still means client-LMS assign/track only.

---

## How to apply locally (not production)

Create the Academy database once, then run additive migrate. Never `migrate:fresh` on product `db_cws`, `db_lms`, `db_academy`, or production.

```bash
# Postgres: CREATE DATABASE db_academy;  (local product only)
cd backend
php artisan migrate
# Taxonomy + IRB template also run from the Academy migration (R20).
# Safe to re-run; updateOrCreate will not duplicate:
php artisan academy:bootstrap
```

Required env (see `backend/.env.example`):

- `DB_ACADEMY_*` → `db_academy`
- `ACADEMY_MEDIA_DISK` — do not hardcode a production disk. Local can be `local`; production uses the configured disk.

PHPUnit uses `db_academy_test` on `127.0.0.1:5433` (`wtc_postgres_test`). Test helpers refuse to wipe any Academy database except `db_academy_test`.

---

## `db_academy` creation / migration

| Item | Result |
|------|--------|
| Laravel connection | `academy` in `backend/config/database.php` |
| Default database name | `db_academy` |
| Test database | `db_academy_test` (phpunit, CI, `scripts/init-test-databases.sql`) |
| Migration | `backend/database/migrations/2026_09_14_140000_create_academy_tables.php` uses `Schema::connection('academy')` only |
| Bootstrap | `AcademyBootstrap::ensure()` at end of migration + `php artisan academy:bootstrap` |
| Idempotent re-run | `updateOrCreate` on tracks/topics/competencies/IRB template slug. Migration `up()` no-ops table create if `academy_learning_tracks` already exists, then re-ensures bootstrap. |
| Deploy scripts | `db_academy` create added to bootstrap/CI helpers. **Not executed against production in this work.** |

---

## Final schema (35 tables)

All on connection `academy` / database `db_academy`:

| Group | Tables |
|-------|--------|
| Taxonomy | `academy_learning_tracks`, `academy_topics`, `academy_competencies` |
| Sources | `academy_legal_sources`, `academy_content_source_links`, `academy_outdated_flags` |
| Courses | `academy_courses`, `academy_course_versions`, `academy_modules`, `academy_lessons`, `academy_lesson_topics`, `academy_lesson_competencies` |
| Cases | `academy_cases`, `academy_case_versions`, `academy_case_exhibits`, `academy_case_questions` |
| Questions | `academy_questions`, `academy_question_versions`, `academy_question_options`, `academy_question_topics`, `academy_question_competencies` |
| Exams | `academy_exam_templates`, `academy_exam_attempts`, `academy_exam_attempt_answers` |
| Practice | `academy_practice_sessions`, `academy_question_attempts` |
| Progress | `academy_learning_progress`, `academy_lesson_completions`, `academy_bookmarks`, `academy_notes`, `academy_question_reports` |
| Planner | `academy_study_plans`, `academy_study_plan_items` |
| Access / audit | `academy_entitlements`, `academy_content_reviews` |

No written-assignment tables (O6). No client LMS table reuse.

---

## Seeded taxonomy / IRB template

Verified by `test_taxonomy_and_irb_template_are_bootstrapped_idempotently` and a second `academy:bootstrap` in the same test (counts unchanged).

| Seed | Result |
|------|--------|
| Tracks | 6 (`irb_specialization` active; entry-to-practice / CPD / professional practice / mentoring / legislation update reserved) |
| IRB topics | 15 (foundations, ID, IAD, RPD, RAD, ethics, professional responsibility, IRPA, IRPR, evidence, administrative law, procedural fairness, hearing preparation, legal research, written submissions) |
| Competencies | 12 |
| IRB mock template | slug `irb-specialization-readiness-mock`, **190 / 240 min / 95 independent + 95 case-based**, `randomize_options = true`, `max_attempts = null` |
| Engine | Those numbers live on the template row only. Admin can create other templates. |

---

## Automated results (2026-09-14)

| Suite | Result |
|-------|--------|
| `AcademyFeatureTest` + `AcademyStaffAccessTest` | **17 passed (150 assertions)** |
| Consultant Vitest `academy-nav` + `team-access` | **4 passed** |
| `TeamStaffAccessTest` | **14 passed (90 assertions)** |
| `CaseFullJourneyReleaseTest` | **1 passed** |
| `ReferralWalletTest` | **21 passed** |
| `SubscriptionBillingHardeningTest` | **17 passed** |
| Combined locked regressions after satellite-DB test wipe | **39 passed (280 assertions)** in the case/wallet/billing filter, plus team 14/90 |

Client LMS has no dedicated feature suite (pre-existing). Academy staff tests prove `lms.view` does not grant Academy.

---

## Matrix

| Check | Result |
|-------|--------|
| Course versioning — learner stays on the version they started; explicit switch to latest | Pass (`test_course_version_pin_and_switch_and_planner_and_admin_analytics`) |
| Question versioning — attempts store `question_version_id`; later draft does not rewrite the attempt set | Pass (`test_mock_exam_hides_keys_scores_mix_and_preserves_versions`) |
| Case-based MCQ — reusable case + exhibits + case_mcq mix in mock | Pass (same mock test: 2 independent + 2 case) |
| Answer-key leak — in-progress Practice/Mock never send `is_correct`, correct IDs, explanations | Pass (practice + mock tests) |
| Server timer — `started_at` / `expires_at` owned by server; expired answer write 422 and finalize | Pass (`test_expired_exam_rejects_answers_and_auto_finalizes`). `duration_seconds` stored as integer. |
| Duplicate / late submit | Pass (second submit 422) |
| Entitlement — no sub 403; grant unlocks; `grant_required` needs course grant; draft hidden | Pass |
| Staff `academy.learn` required; progress is staff user id | Pass (`AcademyStaffAccessTest`) |
| `lms.view` does not grant Academy | Pass |
| Cross-learner IDOR | Pass (404 on another learner’s attempt) |
| Admin review/publish — cannot jump draft→published without override; override writes audit | Pass |
| Outdated source flags linked content; citations after score include published/outdated | Pass |
| Learner analytics / planner / admin analytics | Pass (course pin test hits both analytics endpoints) |
| Client blocked (404); no Academy routes on client portal | Pass (`test_client_is_blocked_from_academy`; `routes/api.php` has consultant + admin Academy only) |
| Frontend — consultant group **RCIC Academy**; learner label **Practice**; admin **Question Bank** | Pass (Vitest + admin page copy) |
| Client LMS regression | No LMS API/scoring/pathway/assignment behavior changed. LMS migrations gained create-if-missing guards only so `migrate:fresh` on CWS does not collide with leftover `db_lms_test` tables. |
| Case-handling regression | `CaseFullJourneyReleaseTest` passed. Phase 0–6 machines not rewritten. |
| Subscription regression | `SubscriptionBillingHardeningTest` passed. No Academy Stripe add-on. |
| Referral/wallet regression | `ReferralWalletTest` passed. |
| Team/staff regression | `TeamStaffAccessTest` passed. Only additive: assignable key `academy.learn`. |

---

## APIs

**Learner** (`/api/v1/consultant/academy/*`) — backend `AcademyAccess` (not frontend SubscriptionGuard):

- Dashboard, tracks, courses, course show (pins version on first open), switch-latest, lesson complete
- Practice sessions + answers
- Cases, exams (start / show / answer / submit / results)
- Analytics, bookmarks, notes, planner, sources, question report

**Admin** (`/api/v1/admin/academy/*`):

- Taxonomy, sources, outdated queue, courses/modules/lessons/media, question bank, cases/exhibits, exam templates, entitlements, reports, analytics
- Workflow transitions with optional `override` (audit on `academy_content_reviews`)

Entitlement rules enforced on the backend:

| Tier | Gate |
|------|------|
| `subscription` | Owner trial/active/grace **or** applicable grant |
| `free` | Authenticated allowed Academy learner |
| `grant_required` | Explicit course/track grant |
| draft / unpublished / archived | Hidden from learners even if entitled |

Staff: `academy.learn` on the membership permission map **and** owner entitlement. Progress/notes/attempts use the **staff user id**.

Clients: 404. Candidates deferred.

---

## Exam / security rules (locked)

- In-progress Practice/Mock payloads omit `is_correct`, correct option IDs, explanations, incorrect-option explanations, and admin comments. Frontend hiding is not the control.
- Server owns `started_at` / `expires_at`. Browser time, refresh, or raw API calls cannot extend an exam.
- Attempts reference exact `question_version_id` and the served `question_set_json`.
- Published meaning is versioned for courses, questions, and cases.

---

## Legal / source workflow

`draft → content_review → legal_review → approved → published → archived`

Ordinary exam-prep content cannot jump author→published unless admin override, which writes `[admin override]` on `academy_content_reviews`.

Academy sources are curated study aids (optional official URL / Legislation Hub link + disclaimer). Not merged with consultant Legislation Hub. No AI rewrite of outdated law.

---

## Frontend

**Consultant Dashboard** — top-level nav group **RCIC Academy** (`academy.learn` for staff):

- `/dashboard/academy` Dashboard
- My Learning, Exam Preparation, Courses
- **Practice** (not “Question Bank”)
- Mock Exams, Study Planner, sources, notes, performance

**Admin Dashboard** — **RCIC Academy** beside LMS Management; Question Bank tab label.

Media uploads use `ACADEMY_MEDIA_DISK` (config `academy.media_disk`).

---

## Files changed (principal)

### Backend

- `config/database.php`, `config/academy.php`, `config/filesystems.php`, `config/team.php`
- `database/migrations/2026_09_14_140000_create_academy_tables.php`
- `app/Services/Academy/*`, `app/Models/Academy/*`
- `app/Http/Controllers/Consultant/ConsultantAcademyController.php`
- `app/Http/Controllers/Admin/AdminAcademyController.php`
- `app/Console/Commands/AcademyBootstrapCommand.php`
- `app/Enums/NotificationType.php` — Academy in-app types
- `routes/api.php` — consultant + admin Academy groups
- `tests/Feature/Academy/*`, `tests/Concerns/RefreshesAcademyDatabase.php`, `tests/TestCase.php`
- LMS migrations: idempotent `hasTable` guard only (no LMS product behavior change)
- `phpunit.xml`, `.env.example`, CI/init scripts — `DB_ACADEMY_*` / `db_academy_test`

### Frontend

- `frontend/Consultant Dashbord` — Academy pages, shell, `lib/academy.ts`, `lib/team-access.ts`, nav
- `frontend/Admins Dashbord` — Academy CMS page + nav

Demo/Public “academy” template pages were not wired to RCIC Academy and are not the client portal.

---

## Remaining limitations

- **Not deployed** to staging or production.
- No real IRB item bank content — engine + CMS + taxonomy/template seeds only.
- v1 cases = scenarios + case-based MCQs. No full simulations, hearing practice, or written-assignment grading.
- No Academy Stripe add-on; no non-RCIC candidate accounts; no client Academy access.
- No AI tutor, flashcards UI, CPD tracker UI, or certificates.
- Exam Readiness Score is an equal-weight four-component **readiness** label, never an official pass prediction or CICC claim.
- Discrimination analytics only when sample size ≥ 20 (top vs bottom quartile).
- Admin CMS and consultant course player are functional v1 workbenches, not a polished authoring studio.
- Admin Academy notifications are in-app to all `admin` and `super-admin` users.
- Maple / decision-support behavior unchanged. Never auto-submit to IRCC.

---

## Security rules still locked

- Do not send answer keys on in-progress attempts.
- Do not trust the client timer or SubscriptionGuard alone.
- Do not wipe `db_cws`, `db_lms`, or product `db_academy` from Academy tests.
- Do not `migrate:fresh` on product or production databases.
- Do not add Academy routes to the client portal.
