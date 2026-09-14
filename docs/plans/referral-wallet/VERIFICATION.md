# Referral + Wallet — verification

**Date:** 2026-09-14  
**Status:** Phases 1–8 implemented locally. No production deploy. No `migrate:fresh`. Case-handling Phase 0–6 untouched.

---

## Locked decisions (implemented)

R1–R20 and O1–O12 (all recommended) are implemented as locked in `PLAN.md`.

| Item | Outcome |
|------|---------|
| O1 | Default reward **50 CAD** |
| O2 | Fixed CAD only; no percentage in v1 |
| O3 | Empty `eligible_package_ids` = all paid platform packages |
| O4 | Wallet credit is a post-tax cash reduction on that invoice (`amount_due`) |
| O5 | First Checkout (`subscription_create`) is **not** credited; renewals / plan-change invoices only |
| O6 | Disabled program still stores clicks; registration does **not** create a payable referral |
| O7 | Same RCIC is application-level block/flag; no unique index on `users.rcic_number` |
| O8 | Shared-office IP is a review flag only |
| O9 | Terms live in settings + consultant in-app dialog |
| O10 | Referrer sees referred first name |
| O11 | Admin wallet adjust with audit |
| O12 | Consultant cancel only before approve (`requested` / `under_review`) |

Business rules confirmed in code and tests:

- Click / registration / RCIC verification / free trial create **no** reward
- Only the referred consultant’s **first successful eligible paid platform subscription** qualifies
- One reward per referred user / referral relationship, ever
- Renewals, recoveries, plan switches, later invoices do not create another reward
- Complimentary admin grants have no paid payment row → do not qualify
- Marketing / storage payments do not qualify and do not consume wallet credit
- Refund / dispute / reversal does **not** reopen a second reward

---

## Phase 6 Stripe invoice lifecycle (re-validated before coding)

Inspected current Stripe invoice events against this codebase (no `invoice.created` / `invoice.upcoming` handlers existed before this work).

| Event | Use in v1 |
|-------|-----------|
| `invoice.upcoming` | Preview only; **no persistent invoice id**. Not used. |
| `invoice.created` | Draft window. Local reserve first, then a **tax-exempt negative invoice item on that invoice only**. Skip if status is not `draft`. |
| `invoice.finalized` | Too late to attach items; we do **not** apply after the fact. |
| `invoice.paid` | Finalize `subscription_credit_applied`; stamp `wallet_credit_amount` on the payment row. |
| `invoice.voided` / attach failure | `subscription_credit_released`. |
| Customer Balance | **Not used.** Leftover customer credit would hit marketing/storage invoices. |

Renewal-only: `billing_reason` in `subscription_cycle`, `subscription_update`, `subscription_threshold`. Isolated via platform subscription metadata (skip `marketing_service` / `storage_addon`). Idempotency keys: `subscription_credit_reserved:invoice:{in_…}` and matching applied/released keys.

---

## Schema (additive, connection `cws`)

- `referral_reward_rules` (versioned; current = `effective_to` null)
- `consultant_referral_codes`
- `consultant_referral_clicks`
- `consultant_referrals` (unique `referred_user_id`)
- `referral_rewards` (unique `referred_user_id`, `referral_id`, qualifying payment/invoice)
- `consultant_wallets` + `consultant_wallet_transactions` (unique `idempotency_key`)
- `consultant_withdrawal_requests` (encrypted account / transit)
- `referral_audit_events`
- `referral_risk_flags`
- `subscription_payment_records.wallet_credit_amount`

---

## Integration points

| Hook | Behavior |
|------|----------|
| `POST /referral/attribute/{code}` + Consultant Website `/ref/[code]` | Store click; cookie + `?ref=` |
| `ConsultantRegisterController` + Google `state=consultant\|CODE` | Attach referral if program enabled |
| `ConsultantOnboardingController` | `rcic_verified` only |
| `startTrial` | `trial_started` only |
| `StripePaymentFulfillmentService` after platform payment row | Qualification (initial paid platform only) + credit finalize |
| `StripeWebhookController` | `invoice.created` / `invoice.voided`; corrected `charge.refunded` via invoice id; `charge.dispute.created` / closed |

---

## State machines

**Referral:** `registered` → `rcic_verified` → `trial_started` (optional) → `subscribed` (`rejected` admin / same-RCIC)

**Reward:** `pending` → `available` → `reversed`; or `pending` → `cancelled` / `rejected`

**Withdrawal:** `requested` → `under_review` → `approved` → `processing` → `paid`; cancel/reject before paid releases the reserve

**Ledger:** immutable posted rows; cache recomputed after every write. Spendable = available − withdrawal reserve − subscription-credit reserve.

---

## APIs

**Public:** `GET /api/v1/referral/resolve/{code}`, `POST /api/v1/referral/attribute/{code}`

**Consultant (`role:rcic`):** referral overview, referrals, wallet, transactions, credit preference, terms, withdrawals + cancel

**Admin:** settings, referrals, ledger, withdrawals (review/approve/reject/processing/paid), wallet adjust/unfreeze, risk flags

---

## UI

- Consultant: sidebar **Referrals & Wallet** → `/dashboard/referrals` (Overview / Referrals / Wallet / Withdrawals)
- Admin: Billing group **Referral Program** → settings, referrals, ledger, withdrawals, review
- Marketing site: `https://rcicmaster.ca/ref/{code}` → `/register?ref=`

---

## Notifications (`category=referral`)

Referrer: registered, verified, qualified, reward pending/available/reversed, withdrawal requested/approved/rejected/paid  
Admin: new withdrawal, high-risk review  
Referred consultant is never shown referrer earnings.

---

## Anti-fraud

Self-referral and same-email / same-RCIC-as-referrer blocked. Existing referrer not overwritten. Duplicate RCIC on another live account = review flag. Shared IP = review only. Card fingerprint not auto-reject. After withdrawn+refund: `admin_recovery` + freeze withdrawals.

---

## Test matrix

| # | Case | Result |
|---|------|--------|
| 1 | Unique referral link | PASS |
| 2 | Click + attribution | PASS |
| 3 | Existing referrer not overwritten | PASS |
| 4 | Self-referral blocked | PASS |
| 5 | Registration stored (no money) | PASS |
| 6 | RCIC verify updates state, no money | PASS |
| 7 | First eligible paid sub qualifies | PASS |
| 8 | Failed / $0 / renewal / recovery / marketing / storage do not qualify | PASS |
| 9 | Duplicate payment cannot create second reward | PASS |
| 10 | Reward pending hold | PASS |
| 11 | Available after hold | PASS |
| 12 | Refund during hold cancels | PASS |
| 13 | Refund after available reverses | PASS |
| 14 | Ledger totals | PASS |
| 15–21 | Withdrawal reserve, double-spend, min, over, reject release, paid, no double-pay | PASS |
| 22 | Consultant cannot see another wallet | PASS |
| 23 | Admin manage settings/ledger/adjust | PASS |
| 24 | Rule snapshot preserved | PASS |
| 25 | Program disable blocks new rewards / new referral rows | PASS |
| 26–27 | Credit ≤ spendable; not applied twice | PASS |
| 28 | Void releases reservation | PASS |
| 29 | Ledger rows never deleted | PASS |
| 30 | Audit on settings / adjust / withdrawals | PASS |
| — | Complimentary / trial / marketing / storage / one-reward-after-refund | PASS |
| — | Charge refund resolves `in_…` not `pi_…` | PASS |
| — | Consultant cancel only before approve | PASS |

---

## Commands run (local, test DB only)

```
php vendor/bin/phpunit tests/Feature/ReferralWallet/ReferralWalletTest.php tests/Feature/SubscriptionBilling/SubscriptionBillingHardeningTest.php
# OK (38 tests, 165 assertions)

php vendor/bin/phpunit tests/Feature/CaseRequirementPlanTest.php tests/Feature/CasePostSubmissionTest.php tests/Feature/CaseFullJourneyReleaseTest.php tests/Feature/CaseFinalReviewAndSubmissionTest.php tests/Feature/CaseClientAssignmentTest.php tests/Feature/CaseAssessmentGateTest.php tests/Feature/CaseActivationAndRepresentativeTest.php
# OK (27 tests, 410 assertions)

# Consultant Dashbord: npm test
# 36 passed (includes lib/__tests__/referral-wallet.test.ts)

php vendor/bin/phpunit --no-coverage
# OK (221 tests, 1104 assertions)
```

RefreshDatabase used `db_cws_test` on `:5433` only. Product `db_cws` was **not** migrated and **not** wiped.

Scheduled: `referral:release-holds` daily 10:00 America/Toronto. Rebuild: `referral:rebuild-wallets`.

---

## Architecture drift

None material. `consultant_referral_codes.user_id` is indexed, not unique, so admin rotation can insert a new permanent code while old codes stay valid. Wallet spendable also subtracts Phase 6 subscription-credit reservations (not only withdrawal reserves) so the same CAD cannot be reserved twice.

---

## Not done (by design)

- Production deploy
- `migrate:fresh`
- Case-handling Phase 0–6 changes
- Persistent Stripe customer balance
- Automatic bank/EFT payouts
- Unique index on `users.rcic_number`
