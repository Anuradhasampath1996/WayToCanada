<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReferralReward extends Model
{
    protected $connection = 'cws';

    public const STATUS_PENDING = 'pending';
    public const STATUS_AVAILABLE = 'available';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_REVERSED = 'reversed';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'referral_id',
        'referred_user_id',
        'referrer_user_id',
        'reward_rule_id',
        'reward_rule_version',
        'reward_amount_snapshot',
        'hold_days_snapshot',
        'currency',
        'status',
        'reward_available_at',
        'available_at',
        'reversed_at',
        'qualifying_payment_record_id',
        'qualifying_stripe_invoice_id',
    ];

    protected function casts(): array
    {
        return [
            'reward_amount_snapshot' => 'decimal:2',
            'hold_days_snapshot' => 'integer',
            'reward_available_at' => 'datetime',
            'available_at' => 'datetime',
            'reversed_at' => 'datetime',
        ];
    }

    public function referral(): BelongsTo
    {
        return $this->belongsTo(ConsultantReferral::class, 'referral_id');
    }

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referrer_user_id');
    }
}
