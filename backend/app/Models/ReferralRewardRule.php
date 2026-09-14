<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReferralRewardRule extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'version',
        'effective_from',
        'effective_to',
        'program_enabled',
        'reward_type',
        'reward_value',
        'currency',
        'eligible_package_ids',
        'applies_to',
        'hold_days',
        'withdrawal_minimum',
        'withdrawal_maximum',
        'wallet_credit_enabled',
        'terms_markdown',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'datetime',
            'effective_to' => 'datetime',
            'program_enabled' => 'boolean',
            'reward_value' => 'decimal:2',
            'eligible_package_ids' => 'array',
            'hold_days' => 'integer',
            'withdrawal_minimum' => 'decimal:2',
            'withdrawal_maximum' => 'decimal:2',
            'wallet_credit_enabled' => 'boolean',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
