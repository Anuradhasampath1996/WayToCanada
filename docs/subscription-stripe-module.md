# RCICMASTER subscription module and Stripe (current behaviour)

This document describes **how the consultant platform subscription is built today**, and **exactly how Stripe subscriptions work** in the live codebase. It is based on the Laravel API, consultant dashboard, and admin tools as they exist now.

**Hardening (2026-09-13):** one live Stripe `sub_…` per consultant, plan change via Subscription Update + preview, 3-day `past_due` grace, Billing Portal card update, webhook event-id idempotency, admin-only legacy `subscribe`. Details: `docs/plans/subscription-billing-hardening/PLAN.md` and `VERIFICATION.md`.

It covers:

- Platform subscription (RCICMASTER plan: trial + paid Stripe Checkout)
- How Stripe Products / Prices / Checkout / webhooks / renewals / cancel work
- Canadian GST/HST on checkout
- Invoices and billing UI
- Related Stripe products (marketing services, storage add-ons, Stripe Connect client payments) so they are not confused with the platform plan

---

## 1. What this module is

RCICMASTER sells **consultant workspace access** as a recurring product:

1. Admin creates **subscription packages** (name, monthly/yearly CAD prices, optional free-trial days, feature list).
2. A verified RCIC must have an **active trial or paid subscription** to use the consultant dashboard.
3. Paid plans are collected with **Stripe Checkout in `subscription` mode** (card on Stripe’s hosted page).
4. Stripe then **auto-renews** monthly or yearly. Laravel listens to webhooks and extends `ends_at`.
5. The consultant can cancel **at period end** (they keep access until `ends_at`). Failed renewals mark the local row `past_due`.

Money for the **platform plan** is charged to **RCICMASTER’s Stripe account** (Admin → Payment Gateway). That is **not** the same as Stripe Connect, which consultants use to take **client** payments.

---

## 2. Stripe roles in this product (do not mix them)

| Stripe use | Who is charged | Stripe mode | Local records |
|------------|----------------|-------------|---------------|
| **Platform subscription** | Consultant pays RCICMASTER | Checkout `mode=subscription`, metadata `type=platform_subscription` | `consultant_subscriptions` + `subscription_payment_records` |
| **Storage add-on** | Consultant pays RCICMASTER | Checkout `mode=subscription`, metadata `type=storage_addon` | `consultant_storage_addons` |
| **Marketing service** | Consultant pays RCICMASTER | Checkout `payment` or `subscription`, metadata `type=marketing_service` | `consultant_marketing_orders` |
| **Client invoices / retainers** | Client pays the **consultant** | Stripe **Connect** on the consultant’s connected account | `client_payment_requests` |

This document’s main path is the first row. Webhooks share one endpoint and branch on `metadata.type` and whether the event has a Connect `account`.

PayPal columns still exist on packages and subscriptions. **Paid platform subscribe in the UI is Stripe.** The old `POST /consultant/subscription/subscribe` endpoint can still create an `active` row **without** talking to Stripe (legacy / admin-style activation). The live paywall uses Checkout, not that endpoint.

---

## 3. How it is built (layers)

```
Admin dashboard
  └─ Packages, Stripe keys, invoices, test-clock tools

Consultant dashboard
  └─ SubscriptionGuard (paywall)
  └─ /dashboard/subscribe  → Stripe Checkout
  └─ /dashboard/billing    → plan, invoices, cancel, auto-renew

Laravel API
  ├─ ConsultantSubscriptionController   status / trial / legacy subscribe
  ├─ StripePaymentController            config, tax-quote, checkout, verify
  ├─ ConsultantBillingController        cancel, auto-renew, invoices
  ├─ StripeWebhookController            POST /api/v1/webhooks/stripe
  ├─ StripeSubscriptionService          Product + Price + Checkout Session
  ├─ StripePaymentFulfillmentService    activate / renew / fail / cancel
  ├─ CanadianBillingTaxService          GST/HST quote
  ├─ GstHstStripeTaxService             Stripe Tax Rate IDs on the subscription
  └─ SubscriptionPaymentRecorder        payment rows + invoice PDF
```

**Access gate:** `frontend/Consultant Dashbord/app/dashboard/(auth)/layout.tsx` wraps the dashboard in `SubscriptionGuard`. If `GET /consultant/subscription` returns `is_active: false`, the consultant sees the plan picker instead of the workspace.

**Exception:** if the logged-in user is **not** license-verified (`is_license_verified` false), the guard **skips** the paywall and treats them as active. Only verified RCICs are forced to subscribe.

---

## 4. Data model

### 4.1 `subscription_packages`

Admin-managed catalogue.

| Field | Meaning |
|-------|---------|
| `name` / `name_fr`, `description` / `description_fr` | Display copy |
| `monthly_price`, `yearly_price` | CAD amounts (not cents) |
| `free_trial_days` | `0` = no trial on that package |
| `features` / `features_fr` | JSON list shown on the paywall |
| `is_active`, `sort_order` | Public listing |
| `stripe_product_id` | Created once: `RCICMASTER — {name}` |
| `stripe_monthly_price_id`, `stripe_yearly_price_id` | Recurring Stripe Prices (CAD, interval month/year) |
| `paypal_*` | Legacy PayPal plan IDs |

Public list: `GET /api/v1/subscription-packages` (no auth). Admin CRUD is under the admin API prefix.

### 4.2 `consultant_subscriptions`

One row per attempt / plan period. A consultant can have history; **access** uses the latest `trial` or `active` row that is still in date.

| Field | Meaning |
|-------|---------|
| `status` | `trial`, `active`, `expired`, `payment_declined`, `cancelled`, and runtime `past_due` from webhooks |
| `is_trial` | True if this row is (or was) a free trial. Used to enforce **one trial per user forever** |
| `trial_ends_at` | Trial access ends here |
| `starts_at`, `ends_at` | Paid period. `ends_at` is the current Stripe period end (moves on each successful invoice) |
| `billing_cycle` | `monthly` or `yearly` |
| `last_payment_at`, `cancelled_at` | Audit |
| `stripe_customer_id` | `cus_…` |
| `stripe_subscription_id` | `sub_…` — used for renew, cancel, sync |
| `stripe_checkout_session_id` | `cs_…` — **idempotency key** so webhook + return page do not create two rows |
| `billing_country`, `billing_province`, `billing_address` | Snapshot used for tax / invoice |

**`isCurrentlyActive()`**

- `trial`: active only if `trial_ends_at` is in the future
- `active`: active if `ends_at` is null **or** in the future
- anything else: no access

`GET /consultant/subscription` also **auto-expires** stale rows: trial past `trial_ends_at` → `expired`; paid past `ends_at` → `expired`.

### 4.3 `subscription_payment_records`

Every successful (or refunded) charge we care about: platform plan, marketing, or storage.

- `payment_category`: `subscription` | `marketing` | `storage`
- `payment_type`: `initial` or `renewal`
- Stripe IDs: `stripe_checkout_session_id`, `stripe_invoice_id`, `stripe_subscription_id`
- Money: `subtotal`, `tax_amount`, `total`, GST/PST split fields, `currency` (CAD)
- `payment_status`: `paid` | `refunded` | `failed`
- Links to invoice PDF (local DomPDF and/or Stripe `hosted_invoice_url`)

### 4.4 `payment_gateway_settings`

Row `gateway = stripe`, `is_active = true`:

- Encrypted `publishable_key`, `secret_key`
- `webhook_id` stores the **webhook signing secret** (`whsec_…`)
- `mode` = `test` or live
- Optional Stripe **test clock** fields for admin time-travel testing
- `last_webhook_at` / `last_webhook_type` for health

If this row is missing or inactive, Checkout and webhooks return **503**.

---

## 5. Admin: how Stripe is turned on

1. Admin → Payment Gateway → Stripe: publishable key, secret key, webhook secret, test vs live.
2. Admin → subscription packages: prices and trial days.
3. First real checkout **creates** the Stripe Product and Price if IDs are empty, then saves them on the package so later checkouts reuse the same Price.
4. Stripe Dashboard must send webhooks to:

   `POST {APP_URL}/api/v1/webhooks/stripe`

   Events the platform handler uses:

   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`

   Connect events (different path, `event.account` set): `checkout.session.completed`, `account.updated`.

Local helper scripts exist (`run-stripe-webhook.bat`, `setup-stripe-cli.bat`) to forward Stripe CLI events to that URL.

---

## 6. Consultant paywall (UI)

File: `frontend/Consultant Dashbord/components/subscription-guard.tsx`

On every authenticated dashboard load:

1. Read token. If no token, do nothing.
2. If user is not license-verified → **no paywall**.
3. Else `GET /api/v1/consultant/subscription`.
4. If `is_active` → render children (normal dashboard).
5. If not active → full-screen plan cards from `GET /subscription-packages`.

Banner states: no plan, trial ended, expired, payment declined, cancelled.

**Start trial:** `POST /consultant/subscription/start-trial` with `subscription_package_id`.

**Pay:** navigate to `/dashboard/subscribe` (or the guard’s subscribe buttons), collect billing address, then Stripe Checkout.

---

## 7. Free trial (no Stripe)

`POST /api/v1/consultant/subscription/start-trial`

Rules:

- User may have **only one** trial ever (`is_trial = true` on any historical row).
- Package must have `free_trial_days > 0`.
- Any current `trial`/`active` row is set to `cancelled`.
- New row: `status=trial`, `is_trial=true`, `trial_ends_at = now + free_trial_days`, no Stripe IDs, no `billing_cycle`.

When `trial_ends_at` passes, status endpoint marks it `expired`. Dashboard locks until they pay.

Trial cancel (Billing): sets `cancelled` immediately (no Stripe call).

---

## 8. Paid Stripe subscription — end-to-end

This is the **complete current paid path**.

### 8.1 Consultant opens subscribe

Page: `frontend/Consultant Dashbord/app/dashboard/subscribe/subscribe-client.tsx`

1. `GET /consultant/payment/stripe/config`  
   Returns `publishable_key` and `test_mode`. If Stripe is off → 503.
2. Consultant picks package + `monthly` | `yearly`.
3. Enters billing address (country, line1, city; **Canadian province required** if country is Canada).
4. `GET /consultant/payment/stripe/tax-quote` with the same fields.  
   `CanadianBillingTaxService`:
   - Outside Canada → tax $0 (treated as export / place-of-supply outside Canada).
   - In Canada → GST/HST (and provincial where applicable) from configured rate tables.

### 8.2 Create Checkout Session

`POST /api/v1/consultant/payment/stripe/checkout-session`

Laravel then:

1. Validates address and recomputes tax.
2. If Canadian tax applies, `GstHstStripeTaxService::ensureTaxRates(province)` creates/reuses Stripe Tax Rate objects and attaches them as `subscription_data.default_tax_rates`.
3. Saves the address onto the user (`company_address_*`).
4. `StripeSubscriptionService::ensureProduct` / `ensurePrice`:
   - Product name: `RCICMASTER — {package name}`
   - Price: `unit_amount = round(CAD * 100)`, `currency=cad`, `recurring.interval = month|year`
5. `Stripe\Checkout\Session::create` with:
   - `mode = subscription`
   - one line item (the Price)
   - `client_reference_id = user id`
   - `customer_email` (or a test-clock customer in admin test mode)
   - `success_url` = `{CONSULTANT_DASHBOARD_URL}/dashboard/subscribe/return?session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url` = `{CONSULTANT_DASHBOARD_URL}/dashboard/subscribe/cancelled`
   - metadata on **session and subscription**:

     ```
     type                    = platform_subscription
     subscription_package_id
     billing_cycle
     user_id
     province
     billing_country
     ```

6. API returns `{ session_id, url, billing_address, tax }`.
7. Browser redirects to Stripe-hosted Checkout (`url`). Card never hits RCICMASTER servers.

### 8.3 After payment — two ways the same fulfillment runs

Stripe marks the session paid and starts a Subscription + first Invoice.

**A. Webhook (source of truth)**  
`checkout.session.completed` → `StripePaymentFulfillmentService::fulfillCheckoutSession` → `fulfillPlatformSubscriptionCheckout`.

**B. Return page (so the UI unlocks even if webhook is slow)**  
`POST /consultant/payment/stripe/verify-session` with `session_id`.  
Checks the session belongs to the logged-in user and `type` is empty or `platform_subscription`, then calls the **same** `fulfillPlatformSubscriptionCheckout`.

Idempotency: if a row already exists with that `stripe_checkout_session_id`, fulfillment returns `{ already: true }` and does not create a second subscription.

### 8.4 What fulfillment writes

`fulfillPlatformSubscriptionCheckout`:

1. Cancel any other local `trial`/`active` rows for that user.
2. Create `consultant_subscriptions`:
   - `status = active`, `is_trial = false`
   - `ends_at` = Stripe `current_period_end` (or +1 month/year fallback)
   - store `stripe_customer_id`, `stripe_subscription_id`, `stripe_checkout_session_id`
   - store billing snapshot
3. Quote tax again (or fall back to Stripe invoice totals).
4. Insert `subscription_payment_records` as `TYPE_INITIAL`, `STATUS_PAID`.
5. Email/in-app “payment succeeded” via `ConsultantBillingNotificationService`.

The consultant is now `is_active` and the guard lets them into the dashboard.

---

## 9. Renewals (how it keeps working after month 1)

Stripe bills the saved payment method automatically.

| Stripe event | What Laravel does |
|--------------|-------------------|
| `invoice.paid` | Find `consultant_subscriptions` by `stripe_subscription_id`. Set `status=active`, `last_payment_at=now`, `ends_at=current_period_end`. Record a **renewal** payment row. Notify consultant. |
| `invoice.payment_failed` | Set local `status=past_due`. Notify renewal failed. Access then fails `isCurrentlyActive()` once `ends_at` is past (status endpoint also expires past `ends_at`). |
| `customer.subscription.updated` | Map Stripe status: `canceled` / `unpaid` / `incomplete_expired` → local `cancelled`; `past_due` / `incomplete` → `past_due`; `active` → refresh `ends_at`. |
| `customer.subscription.deleted` | Same handler as updated (treat as cancelled). |
| `charge.refunded` | Matching payment record → `refunded`. |

Renewal does **not** create a new Checkout Session. The original `sub_…` keeps billing.

---

## 10. Cancel and auto-renew

From Billing (`ConsultantBillingService`):

**Cancel paid Stripe plan**

- `Stripe\Subscription::update(sub_id, { cancel_at_period_end: true })`
- Local: set `cancelled_at`, keep `status=active`, set `ends_at` to Stripe period end
- Consultant **keeps access until that date**
- When the period ends, Stripe sends `customer.subscription.deleted` / updated → local `cancelled`

**Cancel trial**

- Local `cancelled` immediately. No Stripe object.

**Auto-renew toggle**

- `cancel_at_period_end = !enabled` on the Stripe subscription
- Enabling clears `cancelled_at`; disabling sets it

If there is no `stripe_subscription_id` (legacy `subscribe` row), cancel just flips local status.

---

## 11. Legacy `POST /consultant/subscription/subscribe`

Still registered. It:

- Cancels current trial/active
- Creates `status=active` with `ends_at` +1 month or +1 year
- Sets `last_payment_at = now`
- **Does not create a Stripe customer, session, or charge**

The paywall “Continue monthly/yearly” buttons go to **Stripe Checkout**, not this route. Treat `subscribe` as a leftover activation API, not the live card flow.

---

## 12. Invoices and billing screen

- `GET /consultant/billing` — current plan + Stripe period metadata when possible
- `GET /consultant/billing/invoices` — prefers Stripe invoice list for the customer; falls back to local `subscription_payment_records`
- `GET /consultant/billing/payments/{id}/invoice` — DomPDF (`pdf.subscription_invoice`)
- Admin: subscription payments list/export/invoice, consultant subscription expiry override, Stripe test-clock sync

---

## 13. Sequence (paid plan)

```
Consultant (verified RCIC, no active plan)
        │
        ├─ GET  /consultant/subscription          → is_active false
        ├─ GET  /subscription-packages
        ├─ GET  /consultant/payment/stripe/config
        ├─ GET  /consultant/payment/stripe/tax-quote
        │
        └─ POST /consultant/payment/stripe/checkout-session
                 │
                 ▼
           Stripe Checkout (hosted)
                 │  card charged, subscription created
                 ├──────────────────────────────┐
                 ▼                              ▼
   webhook checkout.session.completed    return ?session_id=
   fulfillPlatformSubscriptionCheckout   POST verify-session
                 │                     (same fulfill, idempotent)
                 ▼
        consultant_subscriptions.status = active
        subscription_payment_records (initial)
                 │
                 ▼
        SubscriptionGuard unlocks dashboard
                 │
        every billing period
                 ▼
        invoice.paid → ends_at moved forward, renewal row
```

---

## 14. Statuses (local)

| Status | Access | Typical cause |
|--------|--------|----------------|
| `trial` | Yes until `trial_ends_at` | Start trial |
| `active` | Yes until `ends_at` | Checkout fulfilled or renewal paid |
| `past_due` | No once period lapsed | `invoice.payment_failed` |
| `expired` | No | Status endpoint saw dates in the past |
| `cancelled` | No after period (paid cancel-at-end still `active` until `ends_at`) | User or Stripe canceled |
| `payment_declined` | No | Older / UI banner state |

---

## 15. Related Stripe products (same webhook)

Same `StripeWebhookController` and `StripePaymentFulfillmentService`:

- **Marketing:** metadata `type=marketing_service`. One-time or monthly. Orders in `consultant_marketing_orders`.
- **Storage add-on:** metadata `type=storage_addon`. Recurring extra bytes.
- **Connect:** events with `event.account` mark **client** payment requests paid on the consultant’s Stripe account. This does **not** activate a platform subscription.

---

## 16. Test mode

- Admin Stripe `mode=test` → test keys; Checkout uses test cards.
- `StripeTestClockService`: if a test clock is configured, Checkout attaches a customer on that clock so admin can advance time and fire renewals without waiting a month.
- Admin API: `stripe-test` sync endpoints to pull Stripe subscription state into Laravel.

Never point a production webhook at test keys (or the reverse).

---

## 17. Key files

| Area | Path |
|------|------|
| Status / trial / legacy subscribe | `backend/app/Http/Controllers/ConsultantSubscriptionController.php` |
| Checkout + verify | `backend/app/Http/Controllers/StripePaymentController.php` |
| Webhook | `backend/app/Http/Controllers/StripeWebhookController.php` |
| Product / Price / Session | `backend/app/Services/StripeSubscriptionService.php` |
| Activate / renew / fail | `backend/app/Services/StripePaymentFulfillmentService.php` |
| Cancel / auto-renew / invoices | `backend/app/Services/ConsultantBillingService.php` |
| API keys | `backend/app/Services/StripeService.php` |
| Tax quote | `backend/app/Services/CanadianBillingTaxService.php` |
| Paywall UI | `frontend/Consultant Dashbord/components/subscription-guard.tsx` |
| Subscribe page | `frontend/Consultant Dashbord/app/dashboard/subscribe/` |
| Billing page | `frontend/Consultant Dashbord/app/dashboard/(auth)/billing/billing-client.tsx` |
| Routes | `backend/routes/api.php` (public packages, `webhooks/stripe`, consultant subscription/billing/stripe) |

---

## 18. Operational checklist

1. Stripe gateway row active with keys + webhook secret.
2. Webhook URL reachable from Stripe (production: API host `/api/v1/webhooks/stripe`).
3. At least one `is_active` package with monthly and/or yearly price.
4. `CONSULTANT_DASHBOARD_URL` matches the live consultant origin (success/cancel URLs).
5. Consultant is license-verified, or the paywall will not show.
6. Do not use `migrate:fresh` on production — subscription history lives in the tables above.

---

## 19. Short Sinhala summary

Consultant කෙනෙක් verified නම් dashboard � Short Sinhala summary

Consultant කෙනෙක් verified නම් dashboard එකට යන්න **trial** හෝ **Stripe subscription** එකක් ඕනේ. Trial එක Stripe නැතුව Laravel එකේ විතරයි, user කෙනෙක්ට එක පාරයි. ගෙවීම Stripe Checkout (`subscription` mode) වලින්. Card RCICMASTER server �ීම Stripe Checkout (`subscription` mode) වලින්. Card RCICMASTER server එකට එන්නේ නැහැ. ගෙවුණාම webhook එක හෝ return page එක `consultant_subscriptions` active කරනවා. ඊළඟ මාස/අවුරුදු Stripe එකෙන්ම charge වෙනවා; `invoice.paid` එනකොට `ends_at` දිගට යනවා. Cancel කළ�ිගට යනවා. Cancel කළොත් period එක ඉවර වෙනකල් access තියෙනවා. Client ගෙන් සල්ලි ගන්න Stripe Connect වෙන accoun එකක් — ඒක platform plan එක නෙවෙයි.
