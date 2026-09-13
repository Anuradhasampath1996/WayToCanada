# Platform subscription billing hardening — verification

**Date:** 2026-09-13  
**Scope:** consultant platform subscription / Stripe billing only.  
**Not done:** production deploy, Phase 0–6 case-handling changes, auto-cancel of historical duplicate Stripe subscriptions.

---

## Files changed (principal)

### Backend

- `backend/config/subscription.php` — `SUBSCRIPTION_GRACE_DAYS` (default 3)
- `backend/.env.example` — documents `SUBSCRIPTION_GRACE_DAYS`
- `backend/database/migrations/2026_09_13_200000_harden_consultant_subscription_billing.php`
- `backend/app/Services/StripeSubscriptionStatusMapper.php`
- `backend/app/Contracts/StripePlatformClient.php`
- `backend/app/Services/Stripe/LiveStripePlatformClient.php`
- `backend/app/Services/StripeCustomerResolver.php`
- `backend/app/Services/StripePlatformSubscriptionGuard.php`
- `backend/app/Services/ConsultantPlanChangeService.php`
- `backend/app/Services/StripeBillingPortalService.php`
- `backend/app/Services/StripeDuplicateSubscriptionReportService.php`
- `backend/app/Models/ConsultantSubscription.php` — grace access, `past_due_started_at`
- `backend/app/Models/ConsultantSubscriptionPlanChange.php`
- `backend/app/Models/StripeWebhookEvent.php`
- `backend/app/Models/SubscriptionPaymentRecord.php` — `recovery` type
- `backend/app/Enums/NotificationType.php` — six billing types
- `backend/app/Services/Notifications/ConsultantBillingNotificationService.php`
- `backend/app/Services/StripePaymentFulfillmentService.php`
- `backend/app/Services/SubscriptionPaymentRecorder.php`
- `backend/app/Services/StripeSubscriptionService.php` — reuse customer, no second Checkout when live
- `backend/app/Services/ConsultantBillingService.php`
- `backend/app/Services/StripeSubscriptionSyncService.php` — shared mapper (`past_due` stays `past_due`)
- `backend/app/Http/Controllers/StripePaymentController.php`
- `backend/app/Http/Controllers/StripeWebhookController.php` — event-id idempotency
- `backend/app/Http/Controllers/ConsultantSubscriptionController.php`
- `backend/app/Http/Controllers/Consultant/ConsultantBillingController.php`
- `backend/app/Http/Controllers/Admin/AdminConsultantSubscriptionsController.php` — duplicate report
- `backend/app/Providers/AppServiceProvider.php`
- `backend/routes/api.php`

### Tests

- `backend/tests/Unit/StripeSubscriptionStatusMapperTest.php`
- `backend/tests/Feature/SubscriptionBilling/Phase1AccessAndGraceTest.php`
- `backend/tests/Feature/SubscriptionBilling/SubscriptionBillingHardeningTest.php`
- `backend/tests/Concerns/CreatesSubscriptionFixtures.php`
- `backend/tests/Fakes/FakeStripePlatformClient.php`
- `frontend/Consultant Dashbord/lib/billing-status.ts`
- `frontend/Consultant Dashbord/lib/__tests__/billing-status.test.ts`

### Frontend

- `frontend/Consultant Dashbord/app/dashboard/(auth)/billing/billing-client.tsx`
- `frontend/Consultant Dashbord/components/subscription-guard.tsx`

### Docs

- `docs/plans/subscription-billing-hardening/PLAN.md` (locked decisions)
- this file

---

## Migrations

`2026_09_13_200000_harden_consultant_subscription_billing`

- Converts `consultant_subscriptions.status` from enum/check to **VARCHAR(32)** (PostgreSQL: drop `consultant_subscriptions_status_check`).
- Adds `past_due_started_at`.
- Creates `stripe_webhook_events` (unique `event_id`).
- Creates `consultant_subscription_plan_changes` (audit only; no deletes).

**Applied in this verification** on isolated PHPUnit DB `db_cws_test` / `:5433` via `RefreshDatabase`.  
**Not applied** to product `db_cws` / production.

Do **not** use `migrate:fresh` on product data. Use `php artisan migrate --force` on the intended environment when you choose to deploy.

---

## Exact business flow now

### First paid plan (no live Stripe `sub_…`)

1. Checkout `mode=subscription` via `POST /consultant/payment/stripe/checkout-session`.
2. Existing `stripe_customer_id` is reused; otherwise Stripe creates one customer.
3. `verify-session` and/or `checkout.session.completed` fulfill once (session-id idempotent).
4. One `initial` payment row + one `subscription_payment_succeeded` notification.
5. First `invoice.paid` for that invoice id attaches details if needed and does **not** send a second success email.

### Plan change (live Stripe sub exists)

1. Checkout returns **409** (`use_plan_change: true`).
2. `POST /consultant/billing/change-plan/preview` shows current/new plan, unused credit, immediate charge, tax, new recurring amount, next billing date.
3. Consultant confirms `POST /consultant/billing/change-plan` with that preview.
4. Stripe **Subscription Update** on the same `sub_…` item:
   - `payment_behavior=error_if_incomplete`
   - `always_invoice` for same-interval upgrades and monthly ↔ yearly
   - `create_prorations` for same-interval downgrades / non-immediate adjustments
5. Failed payment: local row and Stripe price **unchanged**; audit row `result=failed`.
6. Success: same local row updated; `consultant_subscription_plan_changes` written.

### Renewal

- Stripe Dashboard Smart Retries only (no Laravel invoice charger).
- `invoice.paid` → `active`, `last_payment_at`, `ends_at`, one `renewal` or `recovery` row, one matching email.
- `invoice.payment_failed` → `past_due` + `past_due_started_at` (first failure) + one failed notice pointing at **Update payment method** (Billing Portal).

### Grace

- `SUBSCRIPTION_GRACE_DAYS=3`.
- During grace: status `past_due`, workspace **open**, warning banner.
- After grace: workspace **blocked**; Stripe sub is **not** cancelled.
- Later `invoice.paid` restores `active`, access, `ends_at`, recovery history, one recovery email.

### Auto-renew

- Off: `cancel_at_period_end=true`, status stays `active`, access until period end, cancellation-scheduled email.
- On before period end: flag cleared.

### Payment method

- `POST /consultant/billing/payment-method-portal` → Stripe Billing Portal `flow_data.type=payment_method_update`.
- Platform customer only — not Connect.

### Legacy subscribe

- `POST /consultant/subscription/subscribe` is **admin / super-admin** complimentary grant (no Stripe).
- RCIC → **403**.
- `start-trial` gated to `rcic | admin | super-admin`.

---

## Stripe plan-switch strategy

| Situation | `proration_behavior` | `payment_behavior` |
|-----------|----------------------|--------------------|
| Same interval, new price higher | `always_invoice` | `error_if_incomplete` |
| Same interval, new price lower / equal | `create_prorations` | `error_if_incomplete` |
| Monthly ↔ yearly | `always_invoice` | `error_if_incomplete` |

`create_prorations` is **not** assumed to charge immediately. Immediate collection uses `always_invoice`.  
`pending_if_incomplete` is **not** used in v1.

---

## Retry ownership

**Stripe Dashboard only.** No Laravel scheduler retries invoices.

Configure in Stripe (test then live):

1. Dashboard → **Billing** → **Subscriptions** → **Manage failed payments** / Smart Retries.
2. Enable retries for subscription invoices; leave cancel-after-N as your policy (app does not cancel on grace end).
3. Billing Portal configuration: allow **update payment method**.
4. Webhook `POST /api/v1/webhooks/stripe` must include:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

---

## Webhook idempotency

1. Verify signature.
2. If `stripe_webhook_events.event_id` exists → `200` `{duplicate: true}`.
3. Process, then insert `event_id`.
4. Unique violation → treat as duplicate.
5. Second layer: unique `stripe_invoice_id` on payment rows; session-id fulfill skip; notification dedupe keys.

---

## Historical duplicate Stripe subscriptions

**Nothing is auto-cancelled.**

Admin report (read-only):

`GET /api/v1/admin/consultant-subscriptions/stripe-duplicates`

Shows user, customer IDs, live Stripe `sub_…`, price, status, period end, and which local row references each.

**Manual cleanup (human inspection required):**

1. Open the report and Stripe Dashboard for that customer.
2. Identify the intended live platform `sub_…`.
3. Cancel extras in Stripe (`cancel` immediately or at period end) after confirming they are platform subscriptions (`metadata.type=platform_subscription`), not marketing/storage/Connect.
4. Leave local payment/subscription history intact; sync or set leftover local rows to `cancelled` if needed.

---

## Test counts

| Suite | Result |
|-------|--------|
| New subscription PHPUnit (`StripeSubscriptionStatusMapperTest` + Phase 1 + Hardening) | **30 passed** (107 assertions) |
| Full PHPUnit | **197 passed** (1012 assertions) |
| Consultant Vitest | **33 passed** (5 files), including 3 new billing-status tests |

PHPUnit uses mocked `FakeStripePlatformClient` (no live Stripe, no production keys).

---

## Remaining limitations

- Marketing and storage add-ons still create their own Stripe subscriptions (by design).
- Complimentary admin grants have no Stripe object.
- Renewal-upcoming / trial-ending emails were skipped (D12).
- Historical consultants with two live `sub_…` need the admin report + manual Stripe cleanup.
- Unique DB index on `stripe_subscription_id` was **not** added globally so existing duplicate IDs cannot break migrate.
- Stripe Smart Retry timing cannot be set from this repo.
- Test-clock live Stripe verification was not run in this pass (no production/test secret used).

---

## Stripe Dashboard settings that still require a human

1. Smart Retries / failed-payment retry schedule.
2. Billing Portal: payment-method update enabled.
3. Webhook events listed above on the API host.
4. Inspect and cancel any pre-existing duplicate live `sub_…` after reviewing the admin report.
