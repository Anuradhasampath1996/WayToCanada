# Non-production staging deployment plan

**Status:** Isolated local staging (API `:8010`, Postgres `:5434`) is up and smoke **PASS 29/29**. Remote public staging host is still **not provisioned**. Production is **untouched**.  
**Date:** 2026-09-13  
**Scope:** Release engineering only. Do not change Phase 0–6 workflow logic. Do not start Phase 7.

This plan stands up a **separate** staging environment and deploys the frozen release candidate. It does **not** deploy to production.

---

## Frozen release candidate

| Item | Value |
|------|--------|
| Implementation commit | `df1439b1d16bafbd2f316afcce3e5c30f1d0a209` |
| RC tag target | `ec670b0b833ff249e7d1474c2f1e04bf6b78ab8b` |
| Tag | `rc-case-handling-phase-0-6` |
| Branch | `release-candidate/case-handling-phase-0-6` |
| Previous production / `main` baseline | `1ac33bc2a5f6b450a3e2012bf521ef07ebb3c3c0` |

**Production data must not go missing.** Existing clients, cases, documents, retainers, and history on production `db_cws` stay in place. Phase 0–6 migrations only **add** nullable columns and new tables. They do not delete rows. On any database that already has data (local product, staging after first seed, or production):

- Allowed: `php artisan migrate` / `migrate --force`
- Forbidden: `migrate:fresh`, `migrate:fresh --seed`, `db:wipe`, dropping the Postgres volume, restoring an empty dump over production

**Code snapshot to deploy and test:** tag `rc-case-handling-phase-0-6` at `ec670b0b833ff249e7d1474c2f1e04bf6b78ab8b` (implementation `df1439b1`). Later commits on `release-candidate/case-handling-phase-0-6` may add documentation only. Those later commits are **not** the frozen application snapshot. Do not deploy `HEAD` of the branch if it has moved past the tag. Do not move or recreate the tag.

Deploy **only** `rc-case-handling-phase-0-6` (`ec670b0b`). Do not deploy `main`. Do not push this tag or branch to `main`.

Production deploy (`.github/workflows/deploy.yml`) runs on **push to `main`**. Leave `origin/main` at `1ac33bc2`.

---

## Why a new environment is required

There is no staging host, staging workflow, or staging database in this repo today. Production is a single EC2 stack under `/opt/waytocanada` with `docker-compose.prod.yml` and PostgreSQL volume `wtc_pgdata`.

**Do not** reuse that host, that Compose project, that volume, or that `.env` for this RC.

---

## Isolation requirements

| Layer | Production (do not touch) | Staging (create) |
|-------|---------------------------|------------------|
| Host | Existing production EC2 (`/opt/waytocanada`) | **New** instance or VM. Different public IP. Different SSH key. |
| DNS | `rcicmaster.ca`, `app.`, `consultant.`, `admin.`, `apply.` | Suggested: `staging.rcicmaster.ca`, `app.staging.rcicmaster.ca`, `consultant.staging.rcicmaster.ca`, `admin.staging.rcicmaster.ca` |
| App directory | `/opt/waytocanada` | `/opt/waytocanada-staging` |
| Compose project | `docker-compose.prod.yml` as-is | Same file is acceptable **only** on the staging host, with a different project name (`-p wtcstaging`) and different container names if both ever share a machine (they must not). |
| Database | Production Postgres `db_cws` / `db_lms` / `db_legal` | **New** Postgres instance or new volume. Databases `db_cws_staging`, `db_lms_staging`, `db_legal_staging`. |
| Env file | Production `backend/.env` | Staging-only `backend/.env` created on the server from `env.staging.example`. Never copy production secrets. |
| Object storage | Production S3 bucket | Separate bucket, e.g. `wtc-staging-uploads` |
| CI | `Production deployment` on `main` | Manual `workflow_dispatch` only, **or** SSH deploy from a laptop. No auto-deploy on `main`. |

If a second EC2 is not available yet, use the **isolated local** stand-in — never the product DB:

```bash
docker compose -f docker-compose.staging.yml up -d
# backend/.env.staging must use DB_*_PORT=5434 and db_*_staging names
php artisan --env=staging migrate --force
php artisan --env=staging db:seed --force   # empty staging DBs only, first time
php artisan --env=staging serve --host=127.0.0.1 --port=8010
node docs/plans/staging-verification/smoke-staging-journey.mjs
```

Do not install this RC on the production instance “in another directory.” Do not point staging env at `:5432` / `db_cws`.

---

## Provisioning checklist (before first deploy)

1. Create a **new** Ubuntu 24.04 host in `ca-central-1` (or a dedicated non-prod VM).
2. Create a **new** SSH key. Do not reuse the production GitHub Actions deploy key.
3. Install Docker and Docker Compose. Follow `deploy/EC2-DEPLOY.md` **only** as a bootstrap pattern; change all paths, users, and domains to staging.
4. Point staging DNS A records at the **new** IP only.
5. Create a staging Postgres volume and empty databases (`db_cws_staging`, `db_lms_staging`, `db_legal_staging`).
6. Create a staging S3 bucket with its own IAM user or role. Do not grant it production bucket write.
7. Issue TLS for the staging hostnames only (staging Certbot names, not production names).
8. Copy `docs/plans/staging-verification/env.staging.example` to the server as `backend/.env` and fill placeholders. **Never commit the filled file.**

First-time empty staging database (only while the volume has no product data):

```bash
php artisan migrate --force --no-ansi
php artisan db:seed --force --no-ansi
```

Use `migrate --seed` on an **empty** staging database. After that first successful migrate/seed, **never** run `migrate:fresh` against staging or production.

---

## Staging-safe configuration

Use `docs/plans/staging-verification/env.staging.example` as the template. Required policy:

### App

- `APP_ENV=staging`
- `APP_DEBUG=false`
- `APP_URL` and frontend URLs must be staging hostnames
- `APP_KEY` generated on the staging host (`php artisan key:generate`). Do not copy production `APP_KEY`.

### Database

- Host, name, user, and password must be staging-only
- Do not point `DB_CWS_*` at production `db_cws`

### Email

- Prefer `MAIL_MAILER=log` or a Mailpit/Mailhog SMTP on the staging host
- If SES/SMTP is used, use a **sandbox** identity and a catch-all test inbox
- `MAIL_FROM_ADDRESS` must be a staging-only address (for example `noreply-staging@…`)
- Do not send invites to real client emails

### Payments

- Leave production Stripe/PayPal live keys unset
- Marketing billing and subscription webhooks must use sandbox credentials **or** stay disabled
- Case retainer in this RC is a signature/document flow, not a live IRCC fee charge. Still: do not process real card charges on staging
- Do not register staging URLs as production webhook endpoints

### Government / external portals

- Phase 0–6 submission **records** a confirmation in RCICMaster. It does not call IRCC or a provincial portal. Keep it that way.
- Do not enter real IRCC portal credentials
- Do not enable CICC full-register scrape (`RCIC_SCRAPE_SEARCH_TERMS` stay narrow or unset)
- Do not run production CRS/IRCC sync jobs as part of smoke

### Messaging and OAuth

- Twilio / WhatsApp Cloud: leave blank or use a dedicated test WABA. Do not reuse production tokens
- Google / Zoom / Teams OAuth: staging redirect URIs only, or leave unset for smoke
- OpenAI: optional staging key with a low spend cap. Maple remains recommend-only

### Webhooks

- Production webhook secrets (`PAYPAL_WEBHOOK_ID`, WhatsApp verify token, Stripe if added later) must not be copied
- If a staging webhook is needed, register a **new** sandbox endpoint that points at the staging host only

---

## Deploy the exact RC tag

On the **staging** host only:

```bash
cd /opt/waytocanada-staging
git fetch --tags origin
git checkout --detach rc-case-handling-phase-0-6
git rev-parse HEAD
# must print: ec670b0b833ff249e7d1474c2f1e04bf6b78ab8b
# Do not checkout the branch tip if it is a later documentation-only commit.
```

Build or pull images tagged with that SHA. Do **not** build from `main` and do **not** use `latest` from production ECR without confirming the digest is `ec670b0b`.

Then:

```bash
docker compose -f docker-compose.prod.yml -p wtcstaging up -d
docker exec <staging-api-container> php artisan config:clear --no-ansi
docker exec <staging-api-container> php artisan migrate --force --no-ansi
docker exec <staging-api-container> php artisan migrate:status --no-ansi
```

Allowed after staging exists:

- `php artisan migrate`
- `php artisan migrate --pretend`
- `php artisan migrate:status`

Forbidden after staging exists:

- `php artisan migrate:fresh`
- `php artisan migrate:fresh --seed`
- `php artisan db:wipe`
- dropping the staging Postgres volume
- any of the above against production `db_cws`

Record the migrate output in `STAGING-SMOKE.md`.

---

## Synthetic staging data

Create **new** test users on staging. Do not restore a production dump that contains real client PII unless it is sanitized first (names, emails, phones, documents, SIN/passport images removed or replaced).

Preferred smoke identities (create on staging only):

| Role | Email pattern |
|------|----------------|
| Consultant | `staging.rcic@example.test` |
| Client | `staging.journey.<timestamp>@example.test` |

Passwords stay on the staging host / in an untracked local fixture. Do not commit them. Do not reuse production passwords.

Do **not** reuse `docs/plans/final-journey-verification/stages.json` (that file contains a live local password and is gitignored).

---

## After deploy

1. Confirm `/up` on the staging API.
2. Confirm consultant and client UIs load on staging hostnames.
3. Run the reduced smoke in `STAGING-SMOKE.md`.
4. Keep production at `1ac33bc2`. Do not merge or push this RC to `main` until that smoke is **PASS**.

---

## Rollback (staging only)

If staging is broken after this RC:

1. Stop staging containers on the staging host.
2. Checkout `1ac33bc2a5f6b450a3e2012bf521ef07ebb3c3c0` on the staging host **or** destroy the staging instance.
3. Do **not** run `migrate:fresh`.
4. Schema rollback (staging DB only, after an export if data must be kept), reverse order:
   - `2026_09_13_110000_create_phase5_post_submission_tables`
   - `2026_09_13_100000_add_phase4_final_review_columns_to_case_files`
   - `2026_09_13_090000_add_phase3_activation_columns_to_case_files`
   - `2026_09_13_080000_add_phase1_assessment_columns_to_case_files`
   - `2026_09_13_070000_create_case_requirement_foundation_tables`

Production rollback is not required: production was never deployed.

---

## What this plan does not do

- Does not deploy to production
- Does not push `main`
- Does not start Phase 7
- Does not change Phase 0–6 gates, Maple boundaries, or submission immutability
- Does not create AWS resources by itself — a human must provision the staging host and database

**Blocked until:** staging hostname, SSH access, and empty staging database credentials are provided.
