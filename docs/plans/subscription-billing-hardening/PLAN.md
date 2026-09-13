# Platform subscription / Stripe billing hardening

**Scope:** consultant platform subscription and Stripe billing only.  
**Out of scope:** RCIC case-handling Phase 0–6, marketing services, storage add-ons, Stripe Connect client payments, production deploy, `migrate:fresh`, production Stripe keys, production data.

This plan is based on the current code in:

- `backend/app/Http/Controllers/ConsultantSubscriptionController.php`
- `backend/app/Http/Controllers/StripePaymentController.php`
- `backend/app/Http/Controllers/StripeWebhookController.php`
- `backend/app/Services/StripeSubscriptionService.php`
- `backend/app/Services/StripePaymentFulfillmentService.php`
- `backend/app/Services/ConsultantBillingService.php`
- `backend/app/Services/StripeSubscriptionSyncService.php`
- `backend/app/Services/Notifications/ConsultantBillingNotificationService.php`
- `frontend/Consultant Dashbord/app/dashboard/(auth)/billing/billing-client.tsx`
- `frontend/Consultant Dashbord/components/subscription-guard.tsx`

---

## Current defects this work must close

1. Plan change / second Checkout creates a **new** Stripe subscription and only cancels the **local** row.
2. Checkout uses `customer_email` and does not reuse `stripe_customer_id`.
3. `POST /consultant/subscription/subscribe` grants paid access without Stripe (`auth:sanctum` only).
4. App writes `past_due`, but the DB enum is `trial|active|expired|payment_declined|cancelled`.
5. Webhook and admin sync map Stripe statuses differently (`past_due` → local `cancelled` in sync).
6. Checkout fulfill + `invoice.paid` can duplicate payment rows / success emails.
7. No Stripe event-id idempotency.
8. No payment-method update for the platform subscription.
9. `past_due` immediately denies access (`isCurrentlyActive()`).
10. Failed-renewal copy points at a Billing card-update UI that does not exist.
11. No automated tests for this module.

---

## Locked product decisions (approved 2026-09-13)

Do not reopen these during implementation.

| # | Locked decision |
|---|-----------------|
| **D1** | Stripe **Subscription Update** on the existing `sub_…`. Never create a second recurring Checkout subscription when a live paid platform subscription exists. |
| **D2** | `payment_behavior = error_if_incomplete`. If a charge is required and fails, the API errors and the update does **not** take effect. Do **not** assume `create_prorations` always charges immediately. Do **not** use `pending_if_incomplete` in v1 unless implementation evidence requires it. |
| **D3** | Same interval downgrade / non-immediate adjustment: `create_prorations` when appropriate. Upgrade that must collect now: `always_invoice` + `error_if_incomplete`. Monthly ↔ yearly: handle carefully (Stripe may reset the cycle and charge immediately). **Preview the proration/invoice and require consultant confirmation before update.** New plan must not become effective if required payment fails; old subscription stays intact. |
| **D4** | Same live local row + same `stripe_subscription_id`. Separate `consultant_subscription_plan_changes` audit. Never destroy billing history. |
| **D5** | Keep `POST /consultant/subscription/subscribe` as **admin/super-admin complimentary/manual grant**. Normal RCIC → **403**. |
| **D6** | `start-trial` gated to `rcic \| admin \| super-admin`. One trial per user. |
| **D7** | Additive migration: status **varchar/string**, officially support `past_due`. No `migrate:fresh` on product data. |
| **D8** | `SUBSCRIPTION_GRACE_DAYS=3`. During grace: status `past_due`, workspace access on, visible warning, payment-method CTA. After grace: block access; Stripe sub remains recoverable. |
| **D9** | Stripe is the only retry owner. No Laravel invoice-charge retry scheduler. Document Dashboard Smart Retry settings. |
| **D10** | Stripe Billing Portal for platform customer/subscription card update. Not Connect. |
| **D11** | Do **not** auto-cancel Stripe when local grace ends. `invoice.paid` after failure restores `active`, access, `ends_at`, recovery payment/history, and **one** recovery email. |
| **D12** | Six notification types only (no renewal-upcoming / trial-ending in this pass). |
| **Duplicates** | Do **not** auto-cancel existing extra live `sub_…`. Prevent new duplicates. Admin reconciliation **report** + manual cleanup instructions. |
| **Preview** | Before plan change, show current/new plan, unused credit, immediate charge, tax, new recurring amount, next billing date. Consultant must confirm. |

### Implementation gate

Decisions above are locked. Implementation proceeds Phase 1 → 7. No production deploy. No Phase 0–6 case-handling changes.

---

## Target business flow

### New paid subscribe (no live Stripe sub)

1. Consultant (role `rcic`) opens paywall → `/dashboard/subscribe`.
2. `POST /consultant/payment/stripe/checkout-session`.
3. If a stored `stripe_customer_id` exists, Checkout uses `customer=cus_…`. Otherwise Stripe creates one customer and we persist it.
4. Checkout `mode=subscription` creates the **only** platform Stripe subscription.
5. `checkout.session.completed` and/or `verify-session` call the same fulfill method (session-id idempotent).
6. One `initial` payment record + one initial-success notification.
7. First `invoice.paid` for that invoice id is a no-op for records/emails.

### Plan switch (live Stripe sub already exists)

1. Billing UI “Change plan” → `POST /consultant/billing/change-plan/preview` then confirm `POST /consultant/billing/change-plan`.
2. Preview shows current/new plan, unused credit, immediate charge, tax, new recurring amount, next billing date.
3. API refuses Checkout if `hasLiveStripeSubscription()`.
4. Confirm uses Subscription Update on the existing item (`error_if_incomplete`; `always_invoice` for immediate upgrades / cycle changes; `create_prorations` for same-interval downgrades).
5. Success: update local package/cycle/`ends_at`; insert `consultant_subscription_plan_changes`.
6. Failure: local row and Stripe price unchanged; 422; no second Stripe sub.

### Renewal

- Owner: Stripe Billing retries (Dashboard).
- `invoice.paid` → active, `last_payment_at`, `ends_at`, one `renewal` or `recovery` payment row, one email.
- `invoice.payment_failed` → `past_due` + `past_due_started_at` (first failure only) + one failed notification pointing at **Update payment method**.

### Auto-renew / cancel

- Off: `cancel_at_period_end=true`, local stays `active`, access until `ends_at`.
- On again before period end: clear the flag and `cancelled_at`.
- Trial cancel remains immediate local cancel.

### Payment method

- `POST /consultant/billing/payment-method-portal` → Stripe Portal URL.
- Not Connect. Not the dummy `payment-method.tsx` card form.

---

## Architecture

New / shared pieces (billing module only):

| Piece | Role |
|-------|------|
| `config/subscription.php` | `grace_days` (env `SUBSCRIPTION_GRACE_DAYS`, default 3) |
| `StripeSubscriptionStatusMapper` | Single Stripe → local map used by webhook, admin sync, billing/status APIs |
| `StripeCustomerResolver` | Reuse existing `cus_…` for the user |
| `StripePlatformSubscriptionGuard` | “Does this user already have a live platform `sub_…`?” |
| `ConsultantPlanChangeService` | Subscription Update + audit row |
| `StripeBillingPortalService` | Portal session for card update |
| `StripeWebhookEvent` model + table | Event-id idempotency |
| `consultant_subscription_plan_changes` | Non-destructive plan-switch history |
| Payment type `recovery` | Paid invoice after `past_due` |

### Shared status map

| Stripe | Local | Access |
|--------|--------|--------|
| `active` | `active` | Yes (until `ends_at` if set) |
| `trialing` | `active` (paid Stripe trial, if any) | Yes |
| `past_due` | `past_due` | Yes only inside grace window |
| `incomplete` | `past_due` | Same grace rule if a live row exists |
| `unpaid`, `incomplete_expired`, `canceled` | `cancelled` | No |

Laravel `trial` (no Stripe) is unchanged.

`isCurrentlyActive()`:

- `trial` + future `trial_ends_at`
- `active` + (`ends_at` null or future)
- `past_due` + now < `past_due_started_at + grace_days`

`ConsultantSubscriptionController::status` and `ConsultantBillingService::currentSubscription` both use this helper so paywall and billing cannot disagree.

Admin sync **must** use the same mapper (`past_due` stays `past_due`).

### Webhook idempotency

Table `stripe_webhook_events`: unique `event_id`, `type`, `processed_at`.

1. Verify signature.
2. If `event_id` exists → `200` `{received:true, duplicate:true}`.
3. Else process, then insert. Unique violation on insert → treat as duplicate.
4. Keep session / invoice unique checks as a second layer.

Downstream uniqueness (additive, nullable-safe):

- `subscription_payment_records.stripe_invoice_id` (already unique)
- unique `consultant_subscriptions.stripe_checkout_session_id` where not null
- unique `consultant_subscriptions.stripe_subscription_id` where not null **only if** existing duplicates are reconciled first (log + keep newest live row; do not delete history)

### Notifications (required six)

| Event | Type | Dedupe key |
|-------|------|------------|
| Initial payment | `subscription_payment_succeeded` | `billing_payment_success:{invoice_id\|session_id}` |
| Renewal | `subscription_renewed` | `billing_renewal_success:{invoice_id}` |
| Recovery | `subscription_renewal_recovered` | `billing_renewal_recovered:{invoice_id}` |
| Renewal failed | `subscription_renewal_failed` | `billing_renewal_failed:stripe:{invoice_id}` |
| Cancel scheduled | `subscription_cancellation_scheduled` | `billing_cancel_scheduled:{sub_id}:{period_end}` |
| Cancelled | `subscription_cancelled` | `billing_cancelled:{sub_id}:{event_id}` |

Failed-renewal body: open Billing → **Update payment method** (Portal). Never “update card in Billing” with no action.

### Billing UI

Show one current platform plan only:

- package, cycle, next billing, auto-renew, cancel-at-end
- `past_due` banner + grace expiry
- Update payment method
- Change plan (calls change-plan API, not Checkout, when a live Stripe sub exists)
- invoices

`SubscriptionGuard`: `past_due` inside grace = workspace + warning; after grace = paywall with recover/update-card CTA.

---

## Phases (implement + tests after each)

### Phase 1 — Schema, mapper, access, grace

- Migration: status varchar + `past_due`; `past_due_started_at`; `grace` config.
- `StripeSubscriptionStatusMapper`.
- `isCurrentlyActive()` + status/billing APIs aligned.
- Tests: mapping table; `past_due` persists; grace access; grace expiry blocks.

### Phase 2 — Webhook idempotency + payment/notification dedupe

- `stripe_webhook_events`.
- Fulfill / `invoice.paid` / `invoice.payment_failed` use mapper + invoice-id uniqueness.
- Distinguish `initial` / `renewal` / `recovery`.
- Tests: duplicate event; verify-session + webhook; first invoice no duplicate row/email; renewal once; failure once.

### Phase 3 — One Stripe subscription + customer reuse + plan switch

- Checkout refused when a live platform `sub_…` exists.
- Reuse `stripe_customer_id`.
- Preview + confirm plan-change endpoints; audit table.
- Admin reconciliation **report** of duplicate live Stripe subs (no auto-cancel).
- Tests: first checkout; customer reused; switch updates price; old price not left billing; failed switch keeps old sub; cannot create two live Stripe subs; preview required.

### Phase 4 — Payment method + auto-renew + cancel notifications

- Billing Portal endpoint + Billing button.
- Auto-renew off/on + cancel-at-period-end access.
- Cancellation scheduled / cancelled notifications.
- Tests: portal session created for existing customer; auto-renew off/on; access until `ends_at`; recovery after mock card update + `invoice.paid`.

### Phase 5 — Legacy subscribe + start-trial auth

- `subscribe` admin-only (or 403 for `rcic`).
- `start-trial` role-gated.
- Tests: consultant cannot activate paid plan via `subscribe`; admin still can.

### Phase 6 — Billing UI + frontend tests

- Billing page fields listed in §15 of the request.
- Vitest: past-due/grace banner, one active plan, portal CTA, change-plan vs checkout branching.
- Do not edit Phase 0–6 case-workspace tests except if a shared type forces it (avoid).

### Phase 7 — Verification

- New PHPUnit file(s) + full backend suite on `db_cws_test` / `:5433`.
- Consultant Vitest.
- Migration on isolated existing-style DB (test/staging Postgres only).
- Stripe test-mode / test clock if local test keys exist; never production keys.
- Write `VERIFICATION.md`.
- **No production deploy.**

---

## Files expected to change

Backend (typical):

- New migrations under `backend/database/migrations/`
- New: mapper, plan-change service, portal service, webhook event model, `config/subscription.php`
- Edit: fulfillment, webhook controller, checkout controller, billing service/controller, subscription controller/model, sync service, notification enum + billing notification service, `routes/api.php`
- New PHPUnit: `tests/Feature/SubscriptionBillingHardeningTest.php` (+ unit mapper test)

Frontend:

- `billing-client.tsx`, `subscription-guard.tsx`, subscribe client (refuse/redirect if already subscribed)
- New Vitest next to billing helpers

Docs:

- this file
- `docs/plans/subscription-billing-hardening/VERIFICATION.md` (after implementation)
- short update to `docs/subscription-stripe-module.md` so it matches the new flow

**Will not change:** case-handling Phase 0–6 controllers, workflow services, or frozen journey docs except incidental mentions.

---

## Test matrix (backend must cover)

1. Initial Checkout activation  
2. Webhook + verify-session idempotency  
3. Duplicate Stripe event  
4. Active plan → different plan switch  
5. Existing Stripe customer reused  
6. Old Stripe subscription not left billing  
7. Failed plan switch keeps old valid subscription  
8. Renewal success  
9. Renewal success notification once  
10. Initial invoice no duplicate success notification  
11. Renewal failure  
12. `past_due` DB status works  
13. Grace-period access  
14. Grace-period expiry blocks access  
15. Payment-method portal flow  
16. Renewal recovery after card update  
17. Auto-renew off  
18. Auto-renew re-enabled  
19. Cancel-at-period-end access retained  
20. Legacy subscribe blocked for consultant  
21. Stripe status mapping consistency  
22. Duplicate invoice/payment record prevention  
23. Two active Stripe subscriptions cannot be created for one consultant  

Stripe PHP SDK calls will be mocked (no live charges in PHPUnit). A separate optional test-clock check is recorded in `VERIFICATION.md` only if test keys are available locally.

---

## Stripe Dashboard (manual, cannot be set in this repo)

Retry ownership stays in Stripe:

- Enable Smart Retries / subscription retry
- Failed-payment emails optional (app sends its own)
- Billing Portal configuration (allow payment-method update)
- Webhook endpoint already: `POST /api/v1/webhooks/stripe` — add events if missing: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`

Document the exact Dashboard clicks in `VERIFICATION.md`.

---

## Risks / limits that will remain

- Historical consultants who already have two live Stripe `sub_…` need a **one-off admin cleanup** (not auto-cancelled in this pass; we only prevent new ones). Mention in verification.
- Marketing / storage add-on Checkout is unchanged (separate Stripe subscriptions by design).
- Complimentary admin grants have no Stripe object; they expire locally via `ends_at`.
- Exact 6-hour custom retry is **not** in this pass.

---

## Implementation status

Locked decisions accepted. Implementation completed 2026-09-13 (no production deploy). See `VERIFICATION.md`.
