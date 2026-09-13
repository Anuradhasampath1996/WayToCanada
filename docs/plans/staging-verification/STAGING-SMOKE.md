# Staging smoke — Phase 0–6 release candidate

**Verdict:** Isolated local staging smoke **PASS 29/29**. Remote public staging host is still **not provisioned**. Production remains **untouched**.  
**Date:** 2026-09-13  
**Production:** untouched (`origin/main` remains `1ac33bc2`). Do not deploy to production until a dedicated non-production host repeats this smoke on the exact frozen RC commit. This local stand-in did **not** write to production `db_cws`.

**Production data must not go missing.** Do not run `migrate:fresh` or wipe `db_cws` on production. Phase 0–6 only adds columns/tables.

**Code snapshot to deploy and test:** tag `rc-case-handling-phase-0-6` → `ec670b0b833ff249e7d1474c2f1e04bf6b78ab8b`. This file may later exist on a documentation-only commit on the release-candidate branch. That later commit is **not** the application snapshot. Keep the tag on `ec670b0b`. Do not move or recreate it.

Deployment procedure: `docs/plans/staging-verification/STAGING-PLAN.md`  
Env template: `docs/plans/staging-verification/env.staging.example`

---

## Record

| Item | Value |
|------|--------|
| Isolated staging host | Local only: API `http://127.0.0.1:8010`, Postgres `127.0.0.1:5434` (`wtc_postgres_staging`). Not production EC2. |
| Staging database | `db_cws_staging` / `db_lms_staging` / `db_legal_staging` on **:5434** (new Docker volume). Production/local product `db_cws` on **:5432** was not used. |
| Staging `.env` | Untracked `backend/.env.staging` (`APP_ENV=staging`, `MAIL_MAILER=log`, no payment/IRCC keys). |
| Code snapshot tested | Phase 0–6 implementation `df1439b1` / tag target `ec670b0b` (same application code as `rc-case-handling-phase-0-6`) |
| Deployed tag on a public host | **Not deployed** |
| Previous main baseline | `1ac33bc2a5f6b450a3e2012bf521ef07ebb3c3c0` |
| Migration command | `php artisan migrate --force` then first-time `db:seed` on the **empty** staging DBs only |
| Migration result | **PASS** — including `2026_09_13_070000` … `110000` |
| Isolated smoke | **PASS 29/29** (`STAGING-JOURNEY.md`) |
| Remote/public staging smoke | **NOT RUN / BLOCKED** — no `staging.rcicmaster.ca` |
| Production deploy | **Not started** |
| Browser UI against consultant :3005 / client :3001 | **Not run** (those apps still talk to product API :8000). Sync checks used staging API only. |

Do not treat this local stand-in as production. Do not push `main` because of this PASS.

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
| 1 | Invite client | PASS | `staging.journey.1789306097709@example.test` |
| 2 | Complete profile | PASS | |
| 3 | Consultation / skip-with-reason | PASS | |
| 4 | Profile review | PASS | |
| 5 | Eligibility assessment | PASS | |
| 6 | Maple recommendation | PASS | `pathway_auto_selected=false` |
| 7 | Pathway selection | PASS | Study Permit plan v1 |
| 8 | Retainer | PASS | Sign only; no live payment |
| 9 | Representative authorization | PASS | Activated; consultant ack 403 |
| 10 | Additional pathway information | PASS | |
| 11 | Documents and verification | PASS | Correction → resubmit → verify |
| 12 | Final consultant review | PASS | `automatic_approval=false` |
| 13 | Client final review / acknowledgement | PASS | |
| 14 | Portal confirmation | PASS | `auto_submitted=false` |
| 15 | Submission record | PASS | Overwrite 422 |
| 16 | Government request | PASS | |
| 17 | Response | PASS | In progress → answered |
| 18 | Decision | PASS | Second write 422 |
| 19 | Closure | PASS | Closed; not in Needs Attention |

**Journey status:** PASS on isolated local staging API. Evidence: `STAGING-JOURNEY.md`.

---

## Cross-system verification

Check after pathway select, after submission, and after closure.

| Surface | Result | Notes |
|---------|--------|-------|
| Dashboard counts | PASS | Pipeline counts; closed case `needs_attention` false |
| Pending Actions | PASS | Same pipeline payload the dashboard uses |
| Progress Board | PASS | `GET /consultant/case-pipeline` 200; closed row present |
| Consultant journey rail | API only | Browser rail not opened (UI still on product :8000) |
| Client journey | PASS | `GET /client/dashboard` 200 |
| Calendar | PASS | Gov-request href to post-submission tab (checked while open) |
| Notifications | PASS | Client action URL includes `government-requests` |
| Case history | PASS | 20 events; `application_submitted` once |
| No auto-submit | PASS | `auto_submitted=false` |
| No duplicate history events | PASS | Submit event count = 1 |

**Sync status:** PASS at API layer on isolated staging. Browser UI on :3005/:3001 was not used.

---

## Issues found

1. **No public/remote staging host.** Isolated local Docker Postgres `:5434` + API `:8010` was used instead. Production AWS was not deployed.
2. **Browser UI smoke skipped** so consultant `:3005` / client `:3001` would not hit product API `:8000` / `db_cws`.
3. First smoke attempt failed 2 sync checks because of wrong paths (`/consultant/dashboard`, calendar after the request was already answered). Script fixed; second run **29/29 PASS**.

---

## Migration log (paste at deploy time)

```
First empty staging DBs on 127.0.0.1:5434 only.
php artisan --env=staging migrate --force
  ... 2026_09_13_070000_create_case_requirement_foundation_tables DONE
  ... 2026_09_13_080000_add_phase1_assessment_columns_to_case_files DONE
  ... 2026_09_13_090000_add_phase3_activation_columns_to_case_files DONE
  ... 2026_09_13_100000_add_phase4_final_review_columns_to_case_files DONE
  ... 2026_09_13_110000_create_phase5_post_submission_tables DONE
php artisan --env=staging db:seed --force
  Roles, RCIC register import, IRCC/pathway/government-form seeders DONE
migrate:fresh was not used.
Product db_cws:5432 was not targeted.
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
