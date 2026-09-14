# Team & Staff Access — verification

**Date:** 2026-09-14  
**Scope:** Phases 1–9 as locked in `PLAN.md` (R1–R18, O1–O12 recommended).  
**Production:** requested 2026-09-14. Deploy uses `php artisan migrate --force` only. Frozen tag `rc-case-handling-phase-0-6` is unchanged.

## What shipped

- Thin `consultant_workspaces` layer (lazy-created for the owner RCIC).
- Spatie role `staff` only. Staff never receive `rcic`.
- Hashed, single-use, 7-day, revocable invitation tokens. Accept sets the staff password. No generated password is emailed.
- Presets are templates. Saved membership JSON is authoritative.
- Scopes: `all_cases`, `assigned_cases`, `selected_cases` (allow-list ∪ assignments).
- Central authorizer: `App\Services\Team\TeamAccess`. Existing `authorizeConsultant` / list queries call it. Phase 0–6 journey machines were not rewritten.
- Owner-only journey, billing, referral/wallet, and team-management actions stay owner-only.
- Staff inherit the owner subscription/trial/grace for workspace use only (`GET /consultant/subscription` is inherited; checkout/portal remain `role:rcic`).
- Consultant Dashboard: Team Management under Client Work, permission-aware nav, staff banner, onboarding skip, locked subscription message (no checkout).
- Consultant Website: `/team/invite/{token}` accept page; login accepts `staff`.

## How to apply locally (not production)

On the **test** database, PHPUnit `RefreshDatabase` already migrates.

On local product `db_cws` (never `migrate:fresh`):

```bash
cd backend
php artisan migrate
php artisan db:seed --class=RolesAndPermissionsSeeder
php artisan db:seed --class=TeamPermissionPresetSeeder
```

## Automated results (2026-09-14)

| Suite | Result |
|-------|--------|
| `TeamStaffAccessTest` | 14 passed (90 assertions) |
| Case journey / assessment / assignment / requirement / final review / post-submission (filter) | included in 69 passed |
| `SubscriptionBillingHardeningTest` | passed |
| `ReferralWalletTest` (in same filter run) | passed |
| Combined existing filter run | **69 passed (589 assertions)** |

Frontend: `lib/__tests__/team-access.test.ts` — 3 passed. `AuthTest` — 9 passed after `GET /me` team context.

## Matrix (PLAN §22)

| # | Check | Result |
|---|--------|--------|
| 1 | Owner can create invitation | Pass |
| 2 | Token hashed, single-use | Pass |
| 3 | Expired invitation rejected | Pass |
| 4 | Accept creates `staff` + active membership | Pass |
| 5–7 | Preset label + customized permissions persist (owner-only keys stripped) | Pass |
| 8 | Staff logs in on a separate user | Pass |
| 9 | `GET /me` staff context; billing/wallet/team omitted | Pass |
| 10 | Hidden owner APIs still 403 | Pass |
| 11–12 | `clients.view` allowed; `clients.edit` denied when off | Pass |
| 13–15 | Assigned / selected / all scopes | Pass |
| 16–17 | Cross-workspace IDOR + list leakage blocked (404) | Pass |
| 18–19 | Assignment grants access; unassign removes unless allow-listed | Pass |
| 20–23 | Permission removal immediate; deactivate 403/404; reactivate restores ACL; revoke sessions | Pass |
| 24–25 | Team audit on invite / permission change; journey history still uses `$request->user()` | Pass (team audit). Case history already stamps actor user id. |
| 26–28 | Staff cannot manage subscription / read referral-wallet / withdraw | Pass (`role:rcic`) |
| 29–33 | Staff cannot profile-review, questionnaire verify, select pathway, ready-to-submit, record submission, client ack | Pass |
| 34 | Owner retains full access | Pass |
| 35–37 | Existing case-handling, billing hardening, referral/wallet tests | Pass |

## Phase 5 manual confirmation

After deploy to a non-prod environment:

1. **No cross-workspace IDOR** — staff token from Workspace A must 404 on Workspace B client/case URLs.
2. **No list leakage** — `GET /consultant/clients` and case-pipeline only return in-scope rows.
3. **Staff cannot call owner-only journey actions** — profile review, pathway confirm, official document/form review, representative send/review/complete, ready-for-client / ready-to-submit, record submission, post-submission decision, close case, send retainer.
4. **Real staff user id** is recorded on `case_history_events` / `client_activity_logs` for work they are allowed to do.
5. **Owner access unchanged** — owner tokens still pass every previous workspace action.

## Security rules still locked

- Staff use their own account; never share the consultant login.
- Invitation tokens hashed at rest; never email a plaintext password.
- Backend `TeamAccess` is authoritative; nav hiding is UX only.
- Tenant isolation is mandatory; prefer 404.
- Existing emails rejected (no identity merge).
- No staff Google OAuth in v1.

## Residual / follow-up (not this implementation)

- Paid seat limits (schema has `seat_limit_override` only).
- Staff joining a second workspace / identity merge.
- Staff Google OAuth.
- Multi-RCIC firm ownership transfer.
- Agreement templates remain owner-owned.
- Storage for staff with `storage.view` is the staff user’s own library, not the owner’s files.
- Production migrate (`php artisan migrate --force` only) and deploy are out of scope.
