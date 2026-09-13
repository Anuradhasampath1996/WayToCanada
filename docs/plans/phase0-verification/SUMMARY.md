# Phase 0 verification — 2026-09-13

Operator checks requested before Phase 1. Isolated fresh DB: `db_cws_phase0_fresh` on Docker Postgres `:5433`. Existing product data stayed on Windows PostgreSQL `db_cws` `:5432`.

| Check | Result | Evidence |
|-------|--------|----------|
| 1. Fresh migrate + seed from zero | **PASS** | `01-fresh-migrate-seed.log` — `migrate:fresh --seed` exit 0. Foundation migration applied. Registry seeded (13 definitions). Pathway catalog 91 nodes. |
| 2. Existing/legacy DB migrate without data loss | **PASS** | `02-legacy-migration-integrity.log` + `02-legacy-migration-status.log` — `Nothing to migrate`. 42 users, 26 profiles, 26 case files still present. New columns nullable. Existing cases keep status/pathway/agreement; `current_requirement_plan_id` remains null until a consultant confirms a pathway. |
| 3. Select → snapshot → change → diff → confirm → history | **PASS** | `03-04-journey-and-registry.log` CHECK3. Plan v1 then v2; old plan superseded not deleted; obsolete items kept; portal confirm recorded; history has old/new plan versions + diff; `auto_submitted=false`. |
| 4. Registry update does not mutate case until apply | **PASS** | `03-04-journey-and-registry.log` CHECK4. After publishing Study Permit v2, frozen snapshot/forms unchanged until explicit apply; then new plan version, old plan retained. |
| 5. Full test suite | **PASS** | `05-full-test-suite.log` — **144 passed / 542 assertions**, exit 0, 187s. Includes Phase 0 unit + feature tests and the existing government-forms / workshop / auth suite. |

**Phase 0 status:** approved / complete.

Phase 1 assessment gates started after these checks passed.
