<?php

return [
    'currency' => 'CAD',
    'link_host' => env('REFERRAL_LINK_HOST', 'https://rcicmaster.ca'),
    'cookie_name' => 'wtc_ref',
    'cookie_days' => 90,
    'code_length' => 8,
    'defaults' => [
        'program_enabled' => true,
        'reward_type' => 'fixed',
        'reward_value' => 50.00,
        'hold_days' => 14,
        'withdrawal_minimum' => 50.00,
        'wallet_credit_enabled' => true,
        'applies_to' => 'first_paid_subscription_only',
        'terms_markdown' => <<<'MD'
# Referral Program Terms (draft for legal/admin review — not final policy)

This draft explains how RCICMaster consultant referrals work.

## Who is eligible
Licensed consultants (RCIC role) may share a unique referral link. The referred person must register as a consultant, complete RCIC verification, and purchase an eligible paid RCICMaster platform subscription.

## When a referral counts
A click, registration, RCIC verification, or free trial does **not** create a reward. The referrer becomes eligible only after Stripe confirms the referred consultant’s **first successful paid platform subscription**.

## One reward only
Each referred consultant generates at most one referral reward for that relationship. Renewals, recoveries, plan changes, and later purchases do not create another reward.

## Hold period
Rewards stay pending for the configured hold days (default 14) after the qualifying payment. They become available only if the payment is not refunded, disputed, or voided.

## Withdrawals
Available wallet funds may be withdrawn to a bank account after admin review. A minimum withdrawal amount applies. Payouts are manual.

## Refunds and disputes
If the qualifying payment is refunded or charged back, the reward is reversed. That does not create a second chance to earn another reward.

## Program abuse
Self-referrals, duplicate accounts, and other abuse may be reviewed or rejected by Admin.
MD,
    ],
];
