# Consultant Referral + Wallet + Withdrawal

**Status:** decisions locked 2026-09-14 — Phases 1–8 implemented locally. See `VERIFICATION.md`. No production deploy.  
**Date:** 2026-09-14  
**Scope:** consultant-to-consultant referral tracking, CAD wallet ledger, hold/reversal, manual withdrawals, optional subscription wallet credit.  
**Out of scope until a later approved plan:** RCIC case-handling Phase 0–6, marketing/storage Stripe subs, Stripe Connect client payouts, automatic bank/EFT payouts, multi-currency, production deploy, `migrate:fresh`.

This plan is based on inspection of the current codebase. There is **no** existing referral, consultant-wallet, or withdrawal module.

---

## Product goal (locked by this request)

Consultant A shares `https://rcicmaster.ca/ref/{code}`.

If Consultant B:

1. opens the link
2. registers
3. becomes RCIC-verified
4. purchases an eligible paid RCICMaster **platform** subscription
5. Stripe confirms a successful **paid** payment

then Consultant A earns **one** configurable referral reward into an RCICMaster wallet.

Consultant A may later:

1. use spendable wallet credit toward their own platform subscription (Phase 6), or
2. request a **manual** bank withdrawal (admin reviews, pays outside the app, marks Paid)

A click, registration, RCIC verification, or **free trial must not create wallet credit**.

**One referred consultant → one first-paid-subscription qualification → one referral reward for the lifetime of that relationship.** Renewals, recoveries, plan changes, cancel+resubscribe, and a second Checkout must not create another reward. A later refund/dispute reverses the original reward; it does **not** reopen a second qualification unless an admin performs a documented correction.

Withdrawal is **not** automatic in v1.

---

## Implementation gate

1. Approve or rewrite the **Recommended locked decisions** and **Open decisions** below.
2. Then implement Phase 0 → 8 in order.
3. No production deploy from this plan.
4. No `migrate:fresh` on product/production `db_cws`.
5. Do not modify Phase 0–6 case-handling workflow or the frozen tag `rc-case-handling-phase-0-6`.
6. Do not break hardened platform billing rules (one live Stripe `sub_…`, Checkout for first paid plan, Subscription Update for plan change, webhook event-id idempotency, no duplicate payment records/emails, `past_due` grace, Billing Portal card update, Stripe Smart Retry only).

---

## 0. Current architecture findings

### What already exists (reuse)

| Area | Finding | Plan use |
|------|---------|----------|
| Platform billing | `StripePaymentFulfillmentService`, `SubscriptionPaymentRecorder`, `StripeWebhookController` | **Only** qualification source. Hook after a paid platform `SubscriptionPaymentRecord` is created/confirmed. |
| Payment types | `initial` / `renewal` / `recovery` | Qualify **only** `initial` + `payment_category=subscription` + `payment_status=paid` + `total > 0`. |
| Invoice idempotency | `subscription_payment_records.stripe_invoice_id` unique; recorder returns existing row | Referral qualification must key off that row / invoice id, not the webhook event alone. |
| Webhook idempotency | `stripe_webhook_events.event_id` unique | Keep as-is. Qualification is a second idempotent write. |
| Checkout vs invoice | Fulfill + first `invoice.paid` already de-dupe payment rows | Call one `ReferralQualificationService` from fulfillment after the payment row exists. Do **not** listen only to the success URL. |
| Complimentary grant | `POST /consultant/subscription/subscribe` is admin-only (billing D5) | Must **not** qualify a referral reward. |
| Trial | `start-trial` is a local grant, not a Stripe paid invoice | Track `trial_started` on the referral if useful; **no** wallet credit. |
| RCIC verification | `ConsultantOnboardingController` sets `users.is_license_verified` / `license_verified_at` | Advance referral to `rcic_verified`. Still no money. |
| Registration | `POST /auth/register/consultant` and Google `state=consultant` in `AuthController` | Persist attribution here. No `referral_code` field exists today. |
| Consultant site | `frontend/Consultant Website` hosts `https://rcicmaster.ca` register at `/register` | Add `/ref/[code]` here. |
| Notifications | `NotificationType` + `NotificationService` + `dedupe_key` | New referral/wallet types; same dedupe pattern. |
| Encryption | `Crypt::encryptString` (`PaymentGatewaySetting`, OAuth tokens) | Encrypt bank account / transit numbers at rest. |
| Roles | `rcic`, `admin`, `super-admin` | No new roles. Ownership checks on every consultant API. |
| Queue / schedule | `database` queue; `routes/console.php` daily jobs | Daily `referral:release-holds`. |
| Trust ledger | `TrustLedgerService` / `client_trust_accounts` | **Do not reuse.** That is client-case money. |
| Connect payouts | `ConsultantPaymentAccount` | **Do not reuse** for referral withdrawals. |
| Currency | Platform invoices recorded as `CAD` | Wallet v1 is CAD only. |
| Consultant nav | `frontend/Consultant Dashbord/components/layout/sidebar/nav-main.tsx` | Add **Referrals & Wallet**. |
| Admin nav | `frontend/Admins Dashbord/components/layout/sidebar/nav-main.tsx` Billing group | Add **Referral Program**. |
| Frontend tests | Consultant Vitest (`lib/__tests__/billing-status.test.ts` style) | Add wallet/referral helpers. Admin tests only if a Vitest suite exists. |

### Gaps / risks found during inspection

1. **No referral or consultant-wallet tables.** Greenfield schema.
2. **`charge.refunded` matching is unreliable.** `handleChargeRefunded` compares `stripe_invoice_id` to `payment_intent` (`pi_…`). Invoice ids are `in_…`. Refund/dispute reversal for rewards **must** resolve the payment record via invoice → charge → payment_intent, not this current match. Fix that lookup as part of Phase 4 (billing-safe, additive).
3. **No `charge.dispute.created` / `invoice.voided` handlers.** Need them for reward reversal.
4. **No `invoice.created` / `invoice.upcoming` handlers.** Wallet-to-subscription credit cannot be bolted on as “subtract locally.” Phase 6 must add a Stripe-lifecycle hook.
5. **`users.rcic_number` is not unique.** Two accounts can claim the same college id. Anti-fraud must treat same RCIC as a **review/block** signal, and onboarding should refuse a second live account with the same verified `rcic_number` when the program is enabled (additive unique index only if data is clean; otherwise application-level + risk flag).
6. **Google OAuth register** creates the user in `AuthController` with no extra payload. Attribution must come from a **server cookie / signed token**, not the Google form.
7. **Success redirect** (`verify-session` / Billing return URL) is not a source of truth. Do not qualify there.
8. **Marketing and storage** have their own Stripe subscriptions. Wallet credit and referral qualification must ignore them.
9. **Customer Balance on the Stripe customer** would also apply to marketing/storage invoices if left sitting on the customer. Do not use a standing customer credit for v1.

---

## 1. Referral links

**Recommended lock:** permanent unique code per eligible consultant (`rcic` role). No silent regenerate. Admin may rotate with audit.

| Rule | Detail |
|------|--------|
| Code | 8–12 Crockford-base32 chars (no `0/O/1/I`). Not the user id. |
| Uniqueness | `consultant_referral_codes.code` unique. |
| Link | `https://rcicmaster.ca/ref/{code}` (Consultant Website). |
| Creation | Lazy-create on first wallet-page load or first eligible consultant access. |
| Eligible issuer | Role `rcic`. Admin/super-admin may have a code only if they also act as a consultant account. |
| Copy/share | Consultant UI copy button + share URL. |
| Ownership | Old codes never reassigned. Rotation inserts a new row; old codes stay valid **or** (open) old codes 301 to the new one. **Recommend:** old codes remain valid so printed links do not break. |

---

## 2. Referral attribution

`GET /ref/{code}` (Consultant Website, server route + API):

1. Validate code exists and program is enabled (disabled program still **records the click** but registration later will not create a payable referral if disabled at register time — see open decision O7).
2. Set an **HttpOnly, Secure, SameSite=Lax** cookie `wtc_ref` = signed payload `{code, clicked_at, ip_hash}` with TTL (recommend 90 days).
3. Insert `consultant_referral_clicks` (analytics + fraud). Click does **not** create a `consultant_referrals` reward row.
4. Redirect to `/register?ref={code}` (code also in query for UX; cookie is authoritative).

On `POST /auth/register/consultant` and Google consultant **new-user** create:

1. Read signed cookie (or signed `ref` if cookie missing).
2. If valid and not self: create `consultant_referrals` (`registered`) with `referrer_user_id` + `referred_user_id`. **One row per referred user** (unique `referred_user_id`).
3. If referred user already has a referrer: **ignore** the new click. No overwrite.
4. Self-referral (same user id after login, same email, or later same RCIC): reject / do not attach.
5. Do not store attribution only in `localStorage`.

Admin may re-attribute with audit (`referral_audit_events`). That is the only mutation of `referrer_user_id` after insert.

---

## 3. Reward qualification

**Mandatory:** money is created only after Stripe-confirmed first eligible **paid** platform subscription.

Tracked referral statuses (no money until noted):

`clicked` (click log only) → `registered` → `rcic_verified` → `trial_started` (optional) → `subscribed` → reward `pending` → `reward_available` → `reversed` / `rejected`

Qualification service (`ReferralQualificationService::onPlatformPaymentRecorded`):

**Must all be true:**

1. Program enabled **at qualification time** (historical already-pending rewards are not cancelled by a later disable — disable blocks **new** qualifications only).
2. `consultant_referrals` exists for the payer (`referred_user_id`).
3. Referred user `is_license_verified = true`.
4. Payment is platform subscription, `TYPE_INITIAL`, `STATUS_PAID`, `total > 0`, CAD.
5. Package is in `eligible_package_ids` (empty list = all paid packages).
6. Referral has no `qualified_at` / no reward row.
7. Payment is not complimentary / not trial.

Then:

- Set `qualified_at`, `qualifying_subscription_id`, `qualifying_payment_record_id`, `qualifying_stripe_invoice_id`, `reward_created_at`.
- Insert `referral_rewards` with **rule snapshot**.
- Status `pending`. `reward_available_at = paid_at + hold_days`.
- Ledger: `referral_reward_pending` (does **not** increase spendable).
- Notify referrer: registered/verified already sent earlier; now `referral subscription qualified` + `reward pending`.

**Must not qualify:** click, register, RCIC verify, trial, Checkout redirect, `TYPE_RENEWAL`, `TYPE_RECOVERY`, plan change invoices, marketing/storage, admin complimentary subscribe, failed/incomplete payment, `$0` invoices.

**One reward only:** unique `(referred_user_id)` on `referral_rewards` and unique `consultant_referrals.referred_user_id`. Application `lockForUpdate` on the referral row inside a transaction.

---

## 4. Admin-configurable referral rules

Table `referral_reward_rules` (versioned; never update historical rows in place for amount/hold):

| Column | v1 |
|--------|----|
| `version` | incrementing int |
| `effective_from` / `effective_to` | timestamps |
| `program_enabled` | bool |
| `reward_type` | `fixed` (v1). `percentage` reserved, not implemented unless approved |
| `reward_value` | decimal CAD (e.g. 50.00) |
| `currency` | `CAD` |
| `eligible_package_ids` | JSON int[] or empty = all paid |
| `applies_to` | `first_paid_subscription_only` |
| `hold_days` | int, default **14** |
| `withdrawal_minimum` | decimal, default **50.00** |
| `withdrawal_maximum` | nullable |
| `wallet_credit_enabled` | bool (preference allowed; Stripe apply is Phase 6) |
| `terms_markdown` | draft copy for legal review |
| `created_by` | admin user id |

**Current settings** = latest row with `effective_to` null.

Changing settings inserts a **new version**. Already created rewards keep `reward_rule_id` + `reward_amount_snapshot` + `hold_days_snapshot` + `currency`.

---

## 5. Referral reward hold

```
successful initial paid invoice
  → reward pending
  → hold until reward_available_at
  → if still valid: available + ledger referral_reward_available
```

Daily scheduled job `referral:release-holds` (America/Toronto, after billing jobs). Also release inline if a later webhook/admin action needs a consistent read.

Invalid during hold (refund/dispute/void/admin reject) → `cancelled`/`reversed`, **no** available credit.

Admin UI shows pending vs available.

---

## 6. Wallet ledger

**Do not** store only a mutable `wallet_balance`.

### `consultant_wallets`

One row per consultant, `currency = CAD`. Cached totals **recomputed from ledger** after every write. Cache is never the authority.

Cached columns (derived):

- `pending_rewards`
- `available_balance`
- `reserved_for_withdrawal`
- `spendable_balance` (= available − reserved)
- `lifetime_earned`
- `lifetime_subscription_credits`
- `lifetime_withdrawn`

### `consultant_wallet_transactions` (immutable)

Every row:

- `wallet_id`, `user_id`
- `type` (see below)
- `direction` (`credit` / `debit`)
- `amount` (always ≥ 0), `currency` (`CAD`)
- `status` (`posted` — v1 no pending ledger rows except reward pending type)
- `reference_type`, `reference_id`
- `idempotency_key` unique
- `description`
- `metadata` JSON
- `created_by` (user id or `system`)
- `created_at`

**Never delete or update amount/type/direction.** Corrections = new compensating rows.

### Transaction types

| Type | Effect on spendable |
|------|---------------------|
| `referral_reward_pending` | pending only |
| `referral_reward_available` | +available |
| `referral_reward_reversal` | −available (or reduce pending) |
| `subscription_credit_reserved` | +reserved / −spendable (Phase 6) |
| `subscription_credit_applied` | −available, +lifetime credits |
| `subscription_credit_released` | undo reserve if invoice fails/voids |
| `withdrawal_reserved` | +reserved / −spendable |
| `withdrawal_released` | undo reserve |
| `withdrawal_paid` | −available, −reserved, +lifetime withdrawn |
| `admin_credit` / `admin_debit` | admin adjustment |
| `admin_recovery` | receivable after withdrawn+refund |

Double-entry **equivalent:** one posted line per economic event with explicit type. Wallet totals are SUM(credits) − SUM(debits) by bucket. Tests assert bucket math.

---

## 7. Wallet balances (consultant-visible)

| Label | Meaning |
|-------|---------|
| Pending Rewards | Pending hold, not spendable |
| Available Balance | Released rewards minus applied credits minus paid withdrawals (before reserve) |
| Reserved for Withdrawal | Open withdrawal requests |
| Spendable Balance | Available − Reserved. **This** is what can be withdrawn or (Phase 6) credited |
| Lifetime Earnings | Sum of `referral_reward_available` (not reversals netted out of this headline — show net earned separately as “Net earned”) |
| Lifetime Subscription Credits Used | Sum of applied credits |
| Lifetime Withdrawn | Sum of `withdrawal_paid` |

**Double-spend rule:** the same CAD 100 cannot be reserved for withdrawal **and** reserved/applied as subscription credit.

Example: Available 200, withdrawal requested 100 → spendable 100, reserved 100.

---

## 8. Withdrawal flow

v1 = **manual bank payout**. App never charges cards or sends EFT.

### Consultant request fields

- amount (CAD)
- account holder name
- bank name
- account number (encrypted)
- transit number (encrypted)
- institution number
- routing/SWIFT optional
- country (default CA)
- optional note

UI shows **masked** account (`•••• 1234`) after submit. Full number only to admin on the request detail (decrypt on read).

### Statuses

`requested` → `under_review` → `approved` → `processing` → `paid`  
also `rejected`, `cancelled`

### On request

1. Program enabled; consultant owns wallet.
2. Amount ≥ `withdrawal_minimum` and ≤ optional max.
3. Amount ≤ spendable.
4. Transaction + lock wallet row.
5. Insert request + `withdrawal_reserved` ledger.
6. Notify consultant + admin.

### Admin

- Review (optional risk)
- Approve
- Mark Processing
- Reject / cancel → `withdrawal_released` (spendable back)
- Mark Paid → `withdrawal_paid`, store `paid_at`, admin id, notes, **payout reference**. Idempotent: second Mark Paid is 409.

Consultant cannot cancel after `processing` without admin.

---

## 9. Admin withdrawal / program UI

Admin sidebar group **Referral Program**:

| Screen | Path (proposed) |
|--------|-----------------|
| Settings | `/admindashboard/referral-program/settings` |
| Referral Records | `/admindashboard/referral-program/referrals` |
| Wallet Transactions | `/admindashboard/referral-program/ledger` |
| Withdrawal Requests | `/admindashboard/referral-program/withdrawals` |
| Fraud / Review Queue | `/admindashboard/referral-program/review` |

Withdrawal list columns: consultant, amount, available/reserved snapshot, bank summary (masked), requested at, status, risk flags, referral history link.

Actions: Review, Approve, Reject, Mark Processing, Mark Paid. All audited.

---

## 10. Use wallet for subscription

Consultant preference on wallet page:

- `Automatically use available wallet credit on my next platform renewal`

and (if UX allows) a one-time “apply to next invoice” toggle.

**Do not implement Stripe application until Phase 6 is designed and approved.** Phase 1–5 only store the preference and spendable balance.

### Recommended Stripe method (Phase 6 — approve)

Use **`invoice.created`** on **platform subscription invoices only** (`metadata.type` empty / platform, not marketing/storage):

1. If preference on and spendable > 0.
2. Compute `credit = min(spendable, invoice.amount_due / 100)` in CAD.
3. Add an **invoice-level** negative amount (invoice item / credit) on **that invoice only** while it is still mutable, **or** apply a one-shot Customer Balance transaction **immediately before** finalization and **reverse any unused remainder after `invoice.paid` / `invoice.voided`** so leftover credit cannot hit a marketing invoice.
4. Locally `subscription_credit_reserved` with idempotency key `invoice:{in_…}`.
5. On `invoice.paid`: `subscription_credit_applied`; payment record must show gross, wallet credit, Stripe charged, tax, final paid.
6. On fail/void: `subscription_credit_released`.
7. Never apply twice (`idempotency_key` + unique invoice id on credit rows).

**Rejected approaches:** locally decrement wallet while Stripe still charges full amount; standing customer balance; coupons that persist across renewals.

**Tax / proration:** credit must not break `CanadianBillingTaxService` / Stripe Tax. Prefer applying credit to **amount due after tax** (cash reduction) so tax lines stay as Stripe calculated, unless legal/finance wants pre-tax credit (open O4).

First Checkout (rare for a referrer who already has earnings): same rule via Checkout `invoice` / customer balance only if Phase 6 explicitly adds it. Default Phase 6 = **renewals only**.

---

## 11. Auto-renew + wallet interaction

| Stripe event | Wallet action |
|--------------|---------------|
| `invoice.created` (platform sub) | Compute credit; reserve locally; attach to **this** invoice |
| Stripe retries (`invoice.payment_failed` then later `invoice.paid`) | Reservation stays until paid/voided; Smart Retry remains the only charger |
| `invoice.voided` | Release reservation |
| `invoice.paid` | Finalize applied credit; payment row amounts must match Stripe `amount_paid` |
| Duplicate webhook | Event-id + credit idempotency key |
| Plan change invoice | Eligible for **credit apply** (referrer paying themselves). **Not** a qualification event for their referrer |

Do not race a custom charger. If the invoice is already finalized/charged before we can attach credit, **do not** apply after the fact on that invoice; wait for the next one. Log + admin visibility.

---

## 12. Refunds / disputes / chargebacks

If the **referred** consultant’s **qualifying** payment is refunded, charged back, disputed, voided, or otherwise invalidated:

| Reward state | Action |
|--------------|--------|
| Pending | Cancel/reject reward. Ledger: pending reversal. No spendable impact. |
| Available, unused | Reverse: `referral_reward_reversal`. Spendable down. |
| Partly used (subscription credit already applied) | Reverse remaining spendable; create `admin_recovery` for the used portion; flag for admin. **Do not delete history.** |
| Already withdrawn | Do **not** delete history. Create `admin_recovery` for the withdrawn amount; freeze new withdrawals until admin clears; risk flag. **Recommend this over a silent negative spendable.** |

A reversal **does not** allow a second qualification.

All reversals audited.

**Webhook work:** add `charge.dispute.created`, `charge.dispute.closed`, and a correct charge→invoice→`SubscriptionPaymentRecord` resolver. Reuse that for `charge.refunded`.

---

## 13. Anti-fraud rules

Signals (never auto-reject on IP/device alone):

| Signal | Action |
|--------|--------|
| Self-referral (same user / email) | Block attach |
| Same RCIC number as referrer | Block attach |
| Existing referrer | Ignore new code |
| Duplicate attribution attempts | Log only |
| Same email / Google id | Block |
| Repeated fake-account pattern (many regs, no verify) | Review flag |
| Refunded / disputed qualifying payment | Reverse + review |
| Cancel/rebuy to farm rewards | Blocked by one-reward rule |
| Stripe card fingerprint (if already available on the charge object) | Risk signal only |

`referral_risk_flags`: `referral_id`, `code`, `severity`, `status` (`open`/`cleared`), `details`, timestamps.

High-risk → admin Review Queue + notification. Do not auto-reject legitimate consultants solely on shared office IP.

---

## 14. Notifications

Use `NotificationService` + `dedupe_key`. Category `referral`.

**Referrer:**

- referral registered
- referral verified
- referral subscription qualified
- reward pending
- reward available
- reward reversed
- withdrawal requested
- withdrawal approved
- withdrawal rejected
- withdrawal paid

**Referred consultant:** do **not** show referrer earnings.

**Admin:**

- new withdrawal request
- high-risk referral/reward review

Copy is product copy, not legal policy.

---

## 15. Referral terms / disclosure

Add a **draft** terms surface (settings `terms_markdown` + consultant “Program terms” dialog).

Must explain: who is eligible, when a referral counts, hold period, refund reversal, withdrawal minimum, abuse, admin review.

Banner: **“Draft for legal/admin review — not final policy.”** Do not invent statute-grade legal text.

---

## 16. Data model

Inspect completed: no existing names to collide. Proposed tables (PostgreSQL, additive migration):

### `consultant_referral_codes`

`id`, `user_id` unique, `code` unique, `is_active`, `created_at`

### `consultant_referral_clicks`

`id`, `code`, `referrer_user_id`, `ip_hash`, `user_agent_hash`, `created_at`  
Index `(code, created_at)`

### `consultant_referrals`

`id`  
`referrer_user_id`  
`referred_user_id` **unique**  
`referral_code_id`  
`status` (`registered`/`rcic_verified`/`trial_started`/`subscribed`/`rejected`)  
`qualified_at` nullable  
`qualifying_subscription_id` nullable  
`qualifying_payment_record_id` nullable unique  
`qualifying_stripe_invoice_id` nullable unique  
`reward_created_at` nullable  
`attribution_locked_at`  
timestamps  

### `referral_reward_rules`

See §4.

### `referral_rewards`

`id`  
`referral_id` unique  
`referred_user_id` **unique** (one reward lifetime)  
`referrer_user_id`  
`reward_rule_id`  
`reward_rule_version`  
`reward_amount_snapshot`  
`hold_days_snapshot`  
`currency`  
`status` (`pending`/`available`/`cancelled`/`reversed`/`rejected`)  
`reward_available_at`  
`available_at` / `reversed_at`  
`qualifying_payment_record_id` unique  
`qualifying_stripe_invoice_id` unique  
timestamps  

### `consultant_wallets`

`id`, `user_id` unique, `currency` default CAD, cached totals, timestamps

### `consultant_wallet_transactions`

See §6. Unique `idempotency_key`. Indexes `(wallet_id, created_at)`, `(reference_type, reference_id)`.

### `consultant_withdrawal_requests`

`id`, `user_id`, `wallet_id`, `amount`, `currency`  
`status`  
encrypted bank fields  
`payout_reference`, `admin_notes`  
`requested_at`, `reviewed_at`, `paid_at`, `processed_by`  
`reserved_transaction_id`, `paid_transaction_id`

### `referral_audit_events`

`id`, `actor_user_id`, `action`, `subject_type`, `subject_id`, `before`, `after`, `ip`, `created_at`

### `referral_risk_flags`

See §13.

**Do not** add a unique index on `users.rcic_number` in v1 unless a data audit shows zero duplicates. Enforce in application + flag.

---

## 17. Referral qualification idempotency

Layered:

1. Stripe `event_id` already unique.
2. Payment row unique on `stripe_invoice_id`.
3. Reward unique on `referred_user_id`, `qualifying_payment_record_id`, `qualifying_stripe_invoice_id`.
4. `lockForUpdate` on `consultant_referrals` for that referred user.
5. Qualification function is nullipotent if already `qualified_at`.

Same payment/webhook arriving twice → one reward.

---

## 18. Currency

v1: wallet, rewards, withdrawals = **CAD only**. One wallet row per consultant. Multi-currency later = separate wallets, never mixed lines.

---

## 19. Permissions

**Consultant (`rcic`):** own link, own referrals, own wallet, own withdrawal, own wallet-credit preference.

**Admin / super-admin:** settings, all referrals, ledger inspect, risk, withdrawals, auditable adjustments.

**Never:** consultant A reads consultant B’s wallet or referral payout amounts.

Policies: `user_id` match on every consultant endpoint (403). Admin routes stay behind `role:super-admin,admin`.

---

## 20. UI/UX

### Consultant — sidebar **Referrals & Wallet** → `/dashboard/referrals`

Tabs: Overview | Referrals | Wallet | Withdrawals

**Overview:** link + copy/share, Total Referrals, Verified, Successful Paid, Pending Rewards, Available, Pending Withdrawals, Lifetime Earnings, recent activity.

**Referrals table:** referred consultant (name + email masked if needed — show name + join date, not bank data), registration date, verification status, subscription status, reward status, reward amount.

**Wallet:** balances in §7 + transaction history.

**Withdrawals:** request form, history, status, payout reference when paid.

Do not expose other consultants’ private billing.

### Admin

Screens in §9. Settings include program enable, amounts, hold, min withdrawal, eligible packages, wallet-credit toggle, draft terms.

---

## 21. Existing Stripe billing integration

Referral/wallet **hooks into** fulfillment. It does **not** create a second Stripe payment system.

Preserve:

- one live platform `sub_…`
- first paid plan = Checkout
- later plan changes = Subscription Update
- Smart Retry only
- Billing Portal payment-method update
- `past_due` grace
- webhook event-id idempotency
- no duplicate payment records/emails

**Exact hook points (implementation):**

1. `StripePaymentFulfillmentService::handlePlatformSubscriptionInvoicePaid` after `recordFromStripeInvoice`
2. `StripePaymentFulfillmentService::fulfillPlatformSubscriptionCheckout` after the initial payment row
3. `ConsultantOnboardingController` after license verify
4. `ConsultantRegisterController::register` + `AuthController::handleGoogleCallback` (new users only)
5. `StripeWebhookController` refund/dispute (corrected resolver) → `ReferralReversalService`
6. Phase 6 only: `invoice.created` in `handlePlatformEvent`

Do not hook marketing/storage fulfill methods.

---

## 22. Tests

Strong automated coverage. Backend PHPUnit must include at least:

1. Unique referral link generated  
2. Referral link attribution works  
3. Existing referrer cannot be overwritten  
4. Self-referral blocked  
5. Referral registration stored  
6. RCIC verification updates referral state  
7. Successful first eligible subscription qualifies reward  
8. Failed payment does not qualify  
9. Duplicate Stripe event/payment cannot create duplicate reward  
10. Reward enters pending hold  
11. Reward becomes available after hold  
12. Refund during hold cancels reward  
13. Refund after available reverses it  
14. Wallet ledger totals correctly  
15. Withdrawal reserves funds  
16. Double-spend prevented  
17. Withdrawal below minimum rejected  
18. Withdrawal over available rejected  
19. Admin reject releases reservation  
20. Mark Paid finalizes withdrawal  
21. Withdrawal cannot be paid twice  
22. Consultant cannot view another wallet  
23. Admin can view/manage referrals  
24. Reward-rule version snapshot preserved  
25. Program disabled prevents **new** referral rewards  
26. Subscription credit cannot exceed spendable  
27. Subscription credit cannot be applied twice  
28. Refund/dispute after wallet usage produces recovery state  
29. Historical ledger entries are never deleted  
30. Audit events for sensitive actions  

Also:

- one referred user cannot qualify twice (renewal / plan change / resubscribe)
- complimentary admin subscribe does not qualify
- trial does not qualify
- marketing/storage payment does not qualify

Frontend: consultant Vitest for balance math / tab visibility / self-referral copy. Admin tests if a suite exists.

---

## 23. Verification (after implementation)

Create `docs/plans/referral-wallet/VERIFICATION.md` **after** coding, not now.

Run:

- new referral/wallet PHPUnit
- full PHPUnit
- consultant Vitest
- admin frontend tests if present
- isolated migration test (`php artisan migrate --force` on **test** DB only)
- existing Stripe subscription-hardening tests
- existing RCIC case-handling tests

No production deploy. No `migrate:fresh` on product/production.

---

## 24. Implementation phases

### Phase 0 — Plan / snapshot (this document)

No code. Approve decisions.

### Phase 1 — Schema + referral settings + audit foundation

Migration (additive). Models. Settings CRUD (admin). Audit helper. Config `referral.php`. No public link yet if settings disabled.

### Phase 2 — Referral link + attribution + registration

Code generation. `/ref/{code}`. Cookie. Register + Google attach. Self-referral / overwrite tests.

### Phase 3 — Subscription qualification + pending reward

Fulfillment hook. Status machine through `subscribed` + pending reward. No spendable yet.

### Phase 4 — Wallet ledger + availability / reversal

Ledger writes. Hold release job. Refund/dispute reversal + corrected charge matching. Balance cache rebuild command.

### Phase 5 — Withdrawal requests + admin workflow

Consultant request. Admin approve/reject/paid. Encryption. Double-pay guard.

### Phase 6 — Subscription wallet credit

`invoice.created` integration. Preference UI. Payment record breakdown. Tests 26–28. **Skip coding until Phase 6 Stripe approach is re-confirmed against live Stripe invoice timing.**

### Phase 7 — Consultant/Admin UI + notifications

Sidebar, tabs, notifications, draft terms.

### Phase 8 — Fraud/risk review + polish

Risk flags, review queue, copy pass, permission sweep, no deploy.

---

## 25. Deliverables

| Deliverable | When |
|-------------|------|
| `docs/plans/referral-wallet/PLAN.md` | **This file** (now) |
| Approved decisions (chat) | Before any code |
| Phased implementation | After approval only |
| `docs/plans/referral-wallet/VERIFICATION.md` | After implementation |
| Open-decision log in VERIFICATION | After implementation |
| Test matrix results | After implementation |
| No production deploy | Entire effort |

After implementation, VERIFICATION.md must record: open decisions outcome, test matrix, phases done, notifications, admin UI, consultant UI, APIs, permissions, anti-fraud, refund strategy, subscription-credit strategy, Stripe qualification point, withdrawal state machine, ledger rules, reward state machine, final schema, integration points, and any architecture drift.

---

## APIs (proposed — implement after approval)

All JSON under `/api/v1`. Consultant: `auth:sanctum` + `role:rcic`. Admin: `role:super-admin,admin`.

**Consultant**

- `GET /consultant/referral` — code, link, overview stats  
- `GET /consultant/referrals` — paginated own referrals  
- `GET /consultant/wallet` — balances + recent ledger  
- `GET /consultant/wallet/transactions`  
- `GET /consultant/withdrawals`  
- `POST /consultant/withdrawals`  
- `PATCH /consultant/wallet/credit-preference`  
- `GET /consultant/referral/terms`  

**Public**

- `GET /referral/resolve/{code}` — valid/disabled + referrer display name only  
- Cookie set by Consultant Website BFF or API `POST /referral/attribute/{code}`

**Admin**

- `GET/PUT /admin/referral-program/settings`  
- `GET /admin/referral-program/referrals`  
- `PATCH /admin/referral-program/referrals/{id}` (correction)  
- `GET /admin/referral-program/ledger`  
- `GET /admin/referral-program/withdrawals`  
- `POST /admin/referral-program/withdrawals/{id}/review|approve|reject|processing|paid`  
- `POST /admin/referral-program/wallets/{user}/adjust`  
- `GET /admin/referral-program/risk-flags`  

---

## State machines

### Referral

`registered` → `rcic_verified` → `trial_started` (optional) → `subscribed` → (`rejected` admin only)

### Reward

`pending` → `available` → `reversed`  
`pending` → `cancelled` / `rejected`

### Withdrawal

`requested` → `under_review` → `approved` → `processing` → `paid`  
any pre-paid (except processing without admin) → `rejected` / `cancelled`

---

## Locked decisions (approved 2026-09-14)

Do not reopen these during implementation.

R1–R20 and O1–O12 (all recommended choices) are locked, including:

- Free trial / registration / RCIC verification create **no** referral reward.
- Only the referred consultant’s **first successful eligible paid platform subscription** qualifies.
- That referred consultant generates **only one** referral reward for the relationship, ever.
- Renewals, recoveries, plan switches, cancel/resubscribe, and later purchases do not create another reward.
- Complimentary admin grants, marketing, and storage payments do not qualify.
- Refund/dispute/reversal does not reopen a second reward unless Admin performs a documented manual correction.
- Phase 6 wallet credit is invoice-specific, renewal-only, idempotent, post-tax cash reduction, isolated from marketing/storage, reserved locally first, finalized on `invoice.paid`, released on void/failure. No persistent Stripe customer balance.

---

## Recommended locked decisions (approve to lock)

| # | Recommendation |
|---|----------------|
| **R1** | One referred user → one first-paid-subscription reward forever. |
| **R2** | Qualify only from fulfillment-created **paid initial platform** payment records. Never from click/register/verify/trial/success URL. |
| **R3** | Complimentary admin subscribe does **not** qualify. |
| **R4** | Marketing/storage payments do **not** qualify and do **not** consume wallet credit. |
| **R5** | Reward type v1 = **fixed CAD**. Default **50.00** (change in settings). |
| **R6** | Hold default **14** days from `paid_at`. |
| **R7** | Withdrawal minimum default **50.00** CAD. Manual payout only. |
| **R8** | Currency CAD only. |
| **R9** | Referral codes permanent; old codes stay valid if rotated. |
| **R10** | Attribution cookie 90 days; first registration wins. |
| **R11** | Link host `https://rcicmaster.ca/ref/{code}`. |
| **R12** | Referred consultant never sees referrer earnings. |
| **R13** | After withdrawn+refund: `admin_recovery` + freeze withdrawals, not silent negative spendable. |
| **R14** | Bank details encrypted at rest; UI masked. |
| **R15** | Card fingerprint = risk signal only. |
| **R16** | Program disable blocks **new** qualifications only. |
| **R17** | Phase 6 is a separate Stripe invoice-credit phase; Phases 1–5 store preference only. |
| **R18** | Phase 6 default: credit **renewals only**, invoice-specific, apply to amount due (post-tax cash reduction) unless finance says otherwise. |
| **R19** | No production deploy; no `migrate:fresh`. |
| **R20** | Do not reuse client trust ledger or Connect accounts. |

---

## Open decisions (need your approval)

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| **O1** | Default reward amount | 25 / 50 / 100 / other | **50 CAD** |
| **O2** | Percentage rewards in v1? | no / yes | **no** |
| **O3** | Eligible packages | all paid / selected ids | **all paid** until admin restricts |
| **O4** | Wallet credit vs tax | post-tax cash reduction / pre-tax | **post-tax cash reduction** |
| **O5** | First Checkout can use wallet? | renewals only / also Checkout | **renewals only** in Phase 6 |
| **O6** | Disable program at click vs at register | still store click / refuse cookie | **store click; refuse new referral row if disabled at register** |
| **O7** | Unique `users.rcic_number` | app-only / unique index | **app-only + risk flag** until data audit |
| **O8** | Shared-office IP | ignore / review | **review flag only** |
| **O9** | Terms URL | in-app dialog only / also public page | **in-app + settings**; public page if you want |
| **O10** | Show referred consultant first name to referrer | yes / initials only | **yes** (they referred a colleague) |
| **O11** | Admin adjustment without payment | allowed with audit | **yes** |
| **O12** | Withdrawal cancel by consultant | until `requested`/`under_review` only | **yes, before approve** |

Reply with **approve R1–R20** and choices for **O1–O12** (or “all recommended”). After that, implementation can start at Phase 1.

---

## What will not happen until you approve

- No migrations on `db_cws` or production  
- No coding  
- No deploy  
- No VERIFICATION.md yet (that file is an after-implementation artifact)
