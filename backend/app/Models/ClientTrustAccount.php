<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClientTrustAccount extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'case_file_id',
        'client_profile_id',
        'consultant_id',
        'currency',
        'total_deposited',
        'total_released',
        'total_refunded',
        'balance_held',
        'status',
        'opened_at',
    ];

    protected function casts(): array
    {
        return [
            'total_deposited' => 'decimal:2',
            'total_released'  => 'decimal:2',
            'total_refunded'  => 'decimal:2',
            'balance_held'    => 'decimal:2',
            'opened_at'       => 'datetime',
        ];
    }

    public function caseFile(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function clientProfile(): BelongsTo
    {
        return $this->belongsTo(ClientProfile::class);
    }

    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consultant_id');
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(TrustLedgerEntry::class)->orderByDesc('occurred_at')->orderByDesc('id');
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(CaseFeeMilestone::class, 'case_file_id', 'case_file_id')->orderBy('sort_order');
    }
}
