<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Failed-renewal grace period
    |--------------------------------------------------------------------------
    |
    | After invoice.payment_failed the local row stays past_due. The consultant
    | keeps workspace access until this many days after past_due_started_at.
    | Stripe remains the only retry owner (Dashboard Smart Retries).
    |
    */
    'grace_days' => max(0, (int) env('SUBSCRIPTION_GRACE_DAYS', 3)),
];
