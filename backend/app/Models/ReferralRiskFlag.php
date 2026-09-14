<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReferralRiskFlag extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'referral_id',
        'user_id',
        'code',
        'severity',
        'status',
        'details',
        'cleared_at',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
            'cleared_at' => 'datetime',
        ];
    }

    public function referral(): BelongsTo
    {
        return $this->belongsTo(ConsultantReferral::class, 'referral_id');
    }
}
