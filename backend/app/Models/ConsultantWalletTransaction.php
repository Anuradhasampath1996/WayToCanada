<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultantWalletTransaction extends Model
{
    protected $connection = 'cws';

    public const TYPE_REWARD_PENDING = 'referral_reward_pending';
    public const TYPE_REWARD_AVAILABLE = 'referral_reward_available';
    public const TYPE_REWARD_REVERSAL = 'referral_reward_reversal';
    public const TYPE_SUB_CREDIT_RESERVED = 'subscription_credit_reserved';
    public const TYPE_SUB_CREDIT_APPLIED = 'subscription_credit_applied';
    public const TYPE_SUB_CREDIT_RELEASED = 'subscription_credit_released';
    public const TYPE_WITHDRAWAL_RESERVED = 'withdrawal_reserved';
    public const TYPE_WITHDRAWAL_RELEASED = 'withdrawal_released';
    public const TYPE_WITHDRAWAL_PAID = 'withdrawal_paid';
    public const TYPE_ADMIN_CREDIT = 'admin_credit';
    public const TYPE_ADMIN_DEBIT = 'admin_debit';
    public const TYPE_ADMIN_RECOVERY = 'admin_recovery';

    protected $fillable = [
        'wallet_id',
        'user_id',
        'type',
        'direction',
        'amount',
        'currency',
        'status',
        'reference_type',
        'reference_id',
        'idempotency_key',
        'description',
        'metadata',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'metadata' => 'array',
        ];
    }

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(ConsultantWallet::class, 'wallet_id');
    }
}
