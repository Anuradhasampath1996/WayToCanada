# Staging smoke — Phase 0–6 release candidate

**Verdict:** **NOT RUN / BLOCKED** — staging host is not provisioned.  
**Date:** 2026-09-13  
**Production:** untouched (`origin/main` remains `1ac33bc2`). Do not deploy to production until this smoke is **PASS** on the exact frozen RC commit.

**Code snapshot to deploy and test:** tag `rc-case-handling-phase-0-6` → `ec670b0b833ff249e7d1474c2f1e04bf6b78ab8b`. This file may later exist on a documentation-only commit on the release-candidate branch. That later commit is **not** the application snapshot. Keep the tag on `ec670b0b`. Do not move or recreate it.

Deployment procedure: `docs/plans/staging-verification/STAGING-PLAN.md`  
Env template: `docs/plans/staging-verification/env.staging.example`

---

## Record

| Item | Value |
|------|--------|
| Staging host | **Not provisioned.** No `staging.rcicmaster.ca` (or equivalent) exists in this repo or deploy config. |
| Staging database | **Not provisioned.** Must be separate from production `db_cws` / `db_lms` / `db_legal`. |
| Staging `.env` | **Not created on a host.** Template only: `env.staging.example`. |
| Deployed tag | `rc-case-handling-phase-0-6` — **not deployed** |
| Deployed commit (required) | `ec670b0b833ff249e7d1474c2f1e04bf6b78ab8b` — **not deployed** |
| Implementation commit | `df1439b1d16bafbd2f316afcce3e5c30f1d0a209` |
| Previous main baseline | `1ac33bc2a5f6b450a3e2012bf521ef07ebb3c3c0` |
| Migration command | `php artisan migrate` only (after first empty-DB seed) |
| Migration result | **Not run** |
| Smoke | **NOT RUN / BLOCKED** |
| Production deploy | **Not started** |
| Branch tip after this docs commit | Documentation only. **Not** the deploy target. |

Fill the host, commit, and migrate rows at deploy time. Do not treat local Windows `127.0.0.1` or production EC2 as this record. Keep smoke **NOT RUN / BLOCKED** until a real non-production staging host is provisioned.

---

## Preflight (must all be true before smoke)

- [ ] Separate staging host (not `/opt/waytocanada` on production)
- [ ] Separate staging Postgres (`db_cws_staging`, not production `db_cws`)
- [ ] Separate staging `.env` (`APP_ENV=staging`)
- [ ] `git rev-parse HEAD` on the staging host = `ec670b0b833ff249e7d1474c2f1e04bf6b78ab8b`
- [ ] `git describe --exact-match --tags` = `rc-case-handling-phase-0-6`
- [ ] Mailer is `log` / Mailpit / SES sandbox — not production SES
- [ ] Payment live keys unset; no production webhooks registered
- [ ] No IRCC / provincial portal credentials entered
- [ ] Smoke users are `@example.test` (or another clearly synthetic domain)
- [ ] `php artisan migrate --pretend` reviewed, then `php artisan migrate --force` only
- [ ] `migrate:fresh` was **not** run after staging data exists

---

## Reduced staging smoke

One **new** synthetic Study Permit client. Consultation may be skip-with-reason. Do not auto-submit. Maple recommend only. Consultant must not acknowledge or sign for the client.

| # | Stage | Result | Notes |
|---|-------|--------|-------|
| 1 | Invite client | — | |
| 2 | Complete profile | — | |
| 3 | Consultation / skip-with-reason | — | |
| 4 | Profile review | — | |
| 5 | Eligibility assessment | — | |
| 6 | Maple recommendation | — | Must not auto-select pathway |
| 7 | Pathway selection | — | Reason required |
| 8 | Retainer | — | No live payment charge |
| 9 | Representative authorization | — | Client completes; consultant cannot sign for client |
| 10 | Additional pathway information | — | |
| 11 | Documents and verification | — | |
| 12 | Final consultant review | — | No automatic approval |
| 13 | Client final review / acknowledgement | — | |
| 14 | Portal confirmation | — | `auto_submitted=false`; nothing sent to IRCC |
| 15 | Submission record | — | Overwrite blocked after first record |
| 16 | Government request | — | |
| 17 | Response | — | In progress → answered |
| 18 | Decision | — | Record once; second write 422 |
| 19 | Closure | — | Checklist then close |

**Journey status:** not executed.

---

## Cross-system verification

Check after pathway select, after submission, and after closure.

| Surface | Result | Notes |
|---------|--------|-------|
| Dashboard counts | — | Closed case must not stay in Needs Attention |
| Pending Actions | — | Action-based only |
| Progress Board | — | Three groups; unique case ids; closed visually separated |
| Consultant journey rail | — | Five stages; no surprise skip |
| Client journey | — | Friendly labels only; no internal status codes |
| Calendar | — | Government-request due date; link to post-submission |
| Notifications | — | Client destination `/user-dashboard/government-requests` |
| Case history | — | `application_submitted` exactly once |
| No auto-submit | — | Portal confirm, ready-to-submit, and submission all `auto_submitted=false` |
| No duplicate history events | — | No repeated submit / decision / close events |

**Sync status:** not executed.

---

## Issues found

1. **Staging environment missing.** This repo has no staging host, staging GitHub workflow, or staging database. Production deploy is `main`-only (`.github/workflows/deploy.yml`).
2. Smoke cannot start until a human provisions the isolation listed in `STAGING-PLAN.md` and provides hostname + SSH + staging DB credentials.

---

## Migration log (paste at deploy time)

```
(not run)
```

Allowed: `php artisan migrate`, `migrate --pretend`, `migrate:status`.  
Forbidden after staging is established: `migrate:fresh`, `migrate:fresh --seed`, `db:wipe`.

---

## Rollback steps

Use the exact RC commit, not `1ac33bc` as the thing being rolled *from* after a staging deploy. Roll **back to** the main baseline.

| Role | Commit |
|------|--------|
| Staging RC (current intended deploy) | `ec670b0b833ff249e7d1474c2f1e04bf6b78ab8b` (`rc-case-handling-phase-0-6`) |
| Implementation | `df1439b1d16bafbd2f316afcce3e5c30f1d0a209` |
| Safe previous production / staging revert | `1ac33bc2a5f6b450a3e2012bf521ef07ebb3c3c0` |

### If staging was never deployed (current state)

1. Do nothing on production.
2. Leave `origin/main` at `1ac33bc2`.
3. Keep tag `rc-case-handling-phase-0-6` for a later staging host.

### If this RC has been deployed to staging

1. On the **staging host only**, check out `1ac33bc2a5f6b450a3e2012bf521ef07ebb3c3c0` and restart staging containers **or** destroy the staging instance.
2. Do **not** run `migrate:fresh`.
3. Do **not** run any command on production `/opt/waytocanada` or production `db_cws`.
4. On the staging database only, after an export if data must be kept, roll back Phase 0–6 migrations in reverse order:
   - `2026_09_13_110000_create_phase5_post_submission_tables`
   - `2026_09_13_100000_add_phase4_final_review_columns_to_case_files`
   - `2026_09_13_090000_add_phase3_activation_columns_to_case_files`
   - `2026_09_13_080000_add_phase1_assessment_columns_to_case_files`
   - `2026_09_13_070000_create_case_requirement_foundation_tables`

### Production

Production rollback is not applicable. Production was not deployed.

---

## After a PASS

1. Set **Verdict** at the top of this file to **PASS**.
2. Fill host, deployed SHA, and migration log.
3. Only then consider a production change-control for `main`. Production still requires an explicit later approval.

Until then: **do not push `main`, do not run production `pull-and-migrate.sh`, do not trigger Production deployment.**
