<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantSubscriptionPlanChange extends Model
{
    protected $fillable = [
        'consultant_subscription_id',
        'user_id',
        'from_package_id',
        'to_package_id',
        'from_billing_cycle',
        'to_billing_cycle',
        'from_stripe_price_id',
        'to_stripe_price_id',
        'proration_behavior',
        'immediate_charge',
        'credit_amount',
        'tax_amount',
        'currency',
        'stripe_invoice_id',
        'result',
        'error_message',
        'preview',
    ];

    protected $casts = [
        'immediate_charge' => 'decimal:2',
        'credit_amount'    => 'decimal:2',
        'tax_amount'       => 'decimal:2',
        'preview'          => 'array',
    ];

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(ConsultantSubscription::class, 'consultant_subscription_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function fromPackage(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPackage::class, 'from_package_id');
    }

    public function toPackage(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPackage::class, 'to_package_id');
    }
}
