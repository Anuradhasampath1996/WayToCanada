# RCIC Case-Handling Full Journey — Release Readiness

**Verdict:** **Release Candidate Ready**  
**Date:** 2026-09-13  
**Scope:** Phase 0–6 case-handling workflow only. No Phase 7 features were added.

---

## Environment

| Item | Value |
|------|--------|
| Host | Windows 10 (`win32 10.0.19045`) |
| Product API | `http://127.0.0.1:8000` (Laravel 12.58.0, PHP 8.2.12) |
| Consultant UI | `http://127.0.0.1:3005` |
| Client portal | `http://127.0.0.1:3001` |
| Product DB | PostgreSQL `db_cws` on `:5432` (not wiped) |
| PHPUnit / fresh-migrate DB | PostgreSQL `db_cws_test` + `db_lms_test` on `:5433` |
| Node | v23.5.0 |
| Playwright | Phase 1 verification install |
| Live journey client | `rc.journey.1789275910860@example.test` (profile **58**, case **57**) |
| Consultant used for live walk | `phase5.smoke@example.test` |

## Commit / hash

| Item | Value |
|------|--------|
| HEAD | `1ac33bc2a5f6b450a3e2012bf521ef07ebb3c3c0` |
| HEAD message | `Include Intake and pathway questionnaire uploads in Document Workshop sources.` |
| Branch | `main` (tracks `origin/main`) |
| Working tree | **Dirty.** Phase 0–6 case-handling work is present locally and is **not yet committed**. RC status applies to this working tree, not to `origin/main` alone. |

---

## Test counts

| Suite | Result |
|-------|--------|
| Full PHPUnit (`php artisan test`) | **167 passed / 905 assertions** (257.55s) |
| `CaseFullJourneyReleaseTest` (one clean client, invite → close) | **1 passed / 115 assertions** |
| Phase 0–6 feature/unit journey tests (gates, assignment, activation, final review, post-submission, Maple, workflow, registry) | All included in the 167 and **passed** |
| Consultant frontend Vitest | **30 passed / 4 files** |
| Client portal unit tests | None present |
| Live API + Playwright full journey | **32/32 PASS** (`JOURNEY.md`) |
| Existing product DB `migrate --pretend` | **Nothing to migrate** |
| Fresh `migrate:fresh --seed` | **PASS** on `db_cws_test:5433` only (roles, RCIC register, IRCC categories, pathway catalog, requirement registry, government form versions) |

---

## Browser scenarios

Screenshots: `docs/plans/final-journey-verification/screenshots/`

| Scenario | Result |
|----------|--------|
| Consultant dashboard counts + Pending Actions | PASS |
| Consultant 5-stage rail on the journey case | PASS |
| Progress Board three groups; journey client visible | PASS |
| Client 5-stage journey (no internal status codes) | PASS |
| Mobile consultant dashboard | PASS |
| Calendar government-request event links to the case | PASS (API + href) |
| Client notifications include `/user-dashboard/government-requests` | PASS |

---

## End-to-end stages (one clean Study Permit case)

Both the isolated PHPUnit client and the live client (`profile 58`) completed the same sequence.

| # | Stage | Isolated test | Live walk |
|---|-------|---------------|-----------|
| 1 | Add client and send invitation | PASS | PASS |
| 2 | Client logs in and completes profile/intake | PASS | PASS |
| 3 | Consultation skip-with-reason | PASS | PASS |
| 4 | Consultant verifies required core profile fields | PASS | PASS |
| 5 | Open Eligibility Assessment | PASS | PASS |
| 6 | Run pathway-family assessment (`family=study`) | PASS | PASS |
| 7 | Ask Maple — recommend only, no auto-select | PASS | PASS |
| 8 | Consultant selects pathway with required reason | PASS | PASS |
| 9 | Versioned `case_requirement_plan` snapshot created | PASS (v1, Study Permit) | PASS (v1) |
| 10 | Extra-data, forms, documents, representative, portals generated | PASS | PASS (`IMM 1294`, `IMM5476`, `acceptance_letter`, rep=required) |
| 11 | Create/send Retainer Agreement | PASS | PASS |
| 12 | Client signs | PASS | PASS |
| 13 | Representative authorization completed (required) | PASS | PASS |
| 14 | Case activation | PASS | PASS |
| 15 | Pathway-specific additional information | PASS | PASS (`dli_number`, `funds_source`) |
| 16 | Upload/reuse required documents | PASS | PASS |
| 17 | Correction → resubmission → verified | PASS | PASS |
| 18 | Application/forms preparation | PASS | PASS (interactive + government forms; hub unlocked) |
| 19 | Consultant Final Review | PASS | PASS (no automatic approval) |
| 20 | Mark Ready for Client Review | PASS | PASS |
| 21 | Client final review/acknowledgement | PASS | PASS |
| 22 | Signature/declaration (snapshot required) | PASS | PASS |
| 23 | Consultant confirms submission portal/method | PASS (`ircc_rep`, `auto_submitted=false`) | PASS |
| 24 | Ready to Submit | PASS | PASS |
| 25 | Record submission fields → Submitted | PASS (overwrite blocked) | PASS |
| 26 | Add government request with due date | PASS | PASS |
| 27 | Appears on calendar and client portal | PASS | PASS |
| 28 | Response in Progress → Answered | PASS | PASS |
| 29 | Record final decision (once) | PASS (second write 422) | PASS |
| 30 | Closure checklist | PASS | PASS |
| 31 | Close the case | PASS | PASS |

---

## Cross-system verification

Checked at major stages (pathway select, activation, submitted, closed):

| Surface | Result |
|---------|--------|
| Dashboard counts / Needs Attention | PASS — closed case is not counted as needing attention |
| Pending Actions | PASS — action-based only |
| Consultant 5-stage rail | PASS — Assessment → Post-submission |
| Client 5-stage journey | PASS — friendly labels only |
| Progress Board group + detailed status | PASS — 3 groups, unique case ids, closed visually separated |
| Calendar | PASS — government-request href to case post-submission |
| Notifications | PASS — client destination `/user-dashboard/government-requests` |
| Case history timeline | PASS — 20 events on live case; `application_submitted` once |

---

## Data and audit checks

| Check | Result |
|-------|--------|
| No duplicate submission history | PASS (`application_submitted` count = 1) |
| Pathway-change does not destroy prior plans/answers | PASS (`CaseRequirementPlanTest`, `CaseClientAssignmentTest`) |
| Old requirement snapshots remain available | PASS (superseded plan kept on pathway change) |
| Registry updates do not silently mutate active cases | PASS (diff only; apply requires confirm) |
| Submission / decision / closure history immutable | PASS (overwrite 422; event `update` throws `LogicException`) |
| Maple never selects, approves, signs, or submits | PASS (`MapleAiBoundaries` + recommend `pathway_auto_selected=false`) |
| Consultant cannot ack/sign for the client | PASS (HTTP 403 on consultant endpoints) |
| No automatic IRCC/provincial submission | PASS (`auto_submitted=false` on portal confirm, ready-to-submit, and submission) |
| Legacy submitted case still accepts a government request | PASS (`CasePostSubmissionTest`) |
| Legacy case without a plan still resolves workflow group | PASS (`CaseRequirementPlanTest`) |

---

## Known limitations

1. **Uncommitted working tree.** Release-candidate status is for the local Phase 0–6 tree, not a tagged commit on `origin/main`.
2. **Notification email warning** (pre-existing): `Call to undefined relationship [consultant] on model [App\Models\User]`. In-app notifications still write and link correctly. Mailer in tests is `array`.
3. **`PUBLIC_DASHBOARD_URL`** in local env may point at port `3002` while the client portal in this session is on `3001`. The path `/user-dashboard/government-requests` is correct.
4. **No client-portal Vitest suite.** Client coverage is API + Playwright.
5. **Live forms unlock** on this Study Permit case was vacuous (no blocking interactive-package forms). Snapshot forms (`IMM 1294`, `IMM5476`) were generated. Interactive form *filling* of a fully assigned IRCC package was not exercised on the live client.
6. **Consultation** used skip-with-reason, not a booked meeting.

---

## Deferred items

- Phase 7 (not started)
- Commit / PR of the Phase 0–6 working tree
- Fix `User::consultant` notification email relationship
- Align `PUBLIC_DASHBOARD_URL` with the running client port
- Optional: client-portal unit tests
- Optional: live walk through a package that requires every interactive form field

---

## Migration notes

- Phase 0–6 added additive migrations on `case_files` plus `case_requirement_plans`, `case_history_events`, `pathway_requirement_definitions`, and Phase 5 government-request / decision / closure tables.
- Product DB (`db_cws:5432`): `php artisan migrate --pretend` → nothing pending.
- Fresh install path verified on **test** DB only: `migrate:fresh --seed` against `db_cws_test:5433` succeeded, including Phase 0–6 migrations and `DatabaseSeeder`.
- **Do not** run `migrate:fresh` against product `db_cws`.

---

## Rollback notes

- Do not wipe `db_cws`.
- To roll back only the Phase 0–6 schema on a clone/staging DB, roll back these migrations in reverse order:
  - `2026_09_13_110000_create_phase5_post_submission_tables`
  - `2026_09_13_100000_add_phase4_final_review_columns_to_case_files`
  - `2026_09_13_090000_add_phase3_activation_columns_to_case_files`
  - `2026_09_13_080000_add_phase1_assessment_columns_to_case_files`
  - `2026_09_13_070000_create_case_requirement_foundation_tables`
- Rolling back those tables/columns will drop requirement-plan snapshots, government requests, and related history. Export first if the data must be kept.
- Application rollback is a code revert of the uncommitted Phase 0–6 tree plus the five migrations above. Existing pre-Phase-0 cases continue to resolve through legacy status mapping (`CaseWorkflowStatus::fromLegacy`).

---

## Evidence

- Isolated journey: `backend/tests/Feature/CaseFullJourneyReleaseTest.php`
- Live walk: `docs/plans/final-journey-verification/JOURNEY.md`
- Live fixture: `docs/plans/final-journey-verification/stages.json`
- Prior phase smokes: `docs/plans/phase0-verification/` through `phase6-verification/`

**RCIC Case-Handling Full Journey — Release Candidate Ready**
