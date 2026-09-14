<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConsultantWallet extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'user_id',
        'currency',
        'pending_rewards',
        'available_balance',
        'reserved_for_withdrawal',
        'spendable_balance',
        'lifetime_earned',
        'lifetime_subscription_credits',
        'lifetime_withdrawn',
        'auto_use_wallet_on_renewal',
        'withdrawals_frozen_at',
    ];

    protected function casts(): array
    {
        return [
            'pending_rewards' => 'decimal:2',
            'available_balance' => 'decimal:2',
            'reserved_for_withdrawal' => 'decimal:2',
            'spendable_balance' => 'decimal:2',
            'lifetime_earned' => 'decimal:2',
            'lifetime_subscription_credits' => 'decimal:2',
            'lifetime_withdrawn' => 'decimal:2',
            'auto_use_wallet_on_renewal' => 'boolean',
            'withdrawals_frozen_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(ConsultantWalletTransaction::class, 'wallet_id');
    }

    public function withdrawalsFrozen(): bool
    {
        return $this->withdrawals_frozen_at !== null;
    }
}
