<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionPaymentRecord extends Model
{
    public const TYPE_INITIAL = 'initial';
    public const TYPE_RENEWAL = 'renewal';

    public const CATEGORY_SUBSCRIPTION = 'subscription';
    public const CATEGORY_MARKETING    = 'marketing';
    public const CATEGORY_STORAGE      = 'storage';

    public const STATUS_PAID     = 'paid';
    public const STATUS_REFUNDED = 'refunded';
    public const STATUS_FAILED   = 'failed';

    protected $fillable = [
        'user_id',
        'payment_category',
        'consultant_subscription_id',
        'subscription_package_id',
        'consultant_marketing_order_id',
        'consultant_storage_addon_id',
        'service_name',
        'payment_type',
        'billing_cycle',
        'stripe_invoice_id',
        'stripe_subscription_id',
        'stripe_checkout_session_id',
        'invoice_number',
        'currency',
        'subtotal',
        'tax_amount',
        'total',
        'tax_label',
        'tax_type',
        'province',
        'country',
        'gst_amount',
        'provincial_tax',
        'total_rate_pct',
        'tax_applicable',
        'billing_address',
        'invoice_pdf',
        'hosted_invoice_url',
        'paid_at',
        'payment_status',
    ];

    protected function casts(): array
    {
        return [
            'subtotal'        => 'decimal:2',
            'tax_amount'      => 'decimal:2',
            'total'           => 'decimal:2',
            'gst_amount'      => 'decimal:2',
            'provincial_tax'  => 'decimal:2',
            'total_rate_pct'  => 'decimal:3',
            'tax_applicable'  => 'boolean',
            'billing_address' => 'array',
            'paid_at'         => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(ConsultantSubscription::class, 'consultant_subscription_id');
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPackage::class, 'subscription_package_id');
    }

    public function marketingOrder(): BelongsTo
    {
        return $this->belongsTo(ConsultantMarketingOrder::class, 'consultant_marketing_order_id');
    }

    public function storageAddon(): BelongsTo
    {
        return $this->belongsTo(ConsultantStorageAddon::class, 'consultant_storage_addon_id');
    }
}
