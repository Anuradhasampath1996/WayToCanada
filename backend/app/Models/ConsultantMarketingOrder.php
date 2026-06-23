<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantMarketingOrder extends Model
{
    protected $connection = 'cws';

    public const STATUS_PENDING  = 'pending';
    public const STATUS_PAID     = 'paid';
    public const STATUS_ACTIVE   = 'active';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'user_id',
        'marketing_service_id',
        'status',
        'amount',
        'billing_type',
        'province',
        'billing_country',
        'billing_address',
        'tax_amount',
        'stripe_checkout_session_id',
        'stripe_subscription_id',
        'paid_at',
        'starts_at',
        'ends_at',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'amount'          => 'decimal:2',
            'tax_amount'      => 'decimal:2',
            'billing_address' => 'array',
            'paid_at'         => 'datetime',
            'starts_at'  => 'datetime',
            'ends_at'    => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(MarketingService::class, 'marketing_service_id');
    }
}
