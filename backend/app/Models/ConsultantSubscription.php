<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantSubscription extends Model
{
    protected $fillable = [
        'user_id',
        'subscription_package_id',
        'status',
        'is_trial',
        'trial_ends_at',
        'starts_at',
        'ends_at',
        'billing_cycle',
        'last_payment_at',
        'cancelled_at',
        'paypal_order_id',
        'paypal_subscription_id',
        'stripe_customer_id',
        'stripe_subscription_id',
        'stripe_checkout_session_id',
    ];

    protected $casts = [
        'is_trial'        => 'boolean',
        'trial_ends_at'   => 'datetime',
        'starts_at'       => 'datetime',
        'ends_at'         => 'datetime',
        'last_payment_at' => 'datetime',
        'cancelled_at'    => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPackage::class, 'subscription_package_id');
    }

    /** Returns true when this subscription is currently granting access. */
    public function isCurrentlyActive(): bool
    {
        if ($this->status === 'trial') {
            return $this->trial_ends_at && $this->trial_ends_at->isFuture();
        }

        if ($this->status === 'active') {
            return $this->ends_at === null || $this->ends_at->isFuture();
        }

        return false;
    }
}
