<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ConsultantReferral extends Model
{
    protected $connection = 'cws';

    public const STATUS_REGISTERED = 'registered';
    public const STATUS_RCIC_VERIFIED = 'rcic_verified';
    public const STATUS_TRIAL_STARTED = 'trial_started';
    public const STATUS_SUBSCRIBED = 'subscribed';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'referrer_user_id',
        'referred_user_id',
        'referral_code_id',
        'status',
        'qualified_at',
        'qualifying_subscription_id',
        'qualifying_payment_record_id',
        'qualifying_stripe_invoice_id',
        'reward_created_at',
        'attribution_locked_at',
    ];

    protected function casts(): array
    {
        return [
            'qualified_at' => 'datetime',
            'reward_created_at' => 'datetime',
            'attribution_locked_at' => 'datetime',
        ];
    }

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referrer_user_id');
    }

    public function referred(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referred_user_id');
    }

    public function code(): BelongsTo
    {
        return $this->belongsTo(ConsultantReferralCode::class, 'referral_code_id');
    }

    public function reward(): HasOne
    {
        return $this->hasOne(ReferralReward::class, 'referral_id');
    }
}
