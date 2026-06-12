<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrustLedgerEntry extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'client_trust_account_id',
        'case_file_id',
        'client_profile_id',
        'entry_type',
        'direction',
        'amount',
        'currency',
        'balance_after',
        'title',
        'description',
        'reference_type',
        'reference_id',
        'case_fee_milestone_id',
        'milestone_invoice_id',
        'actor_user_id',
        'actor_type',
        'metadata',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'amount'        => 'decimal:2',
            'balance_after' => 'decimal:2',
            'metadata'      => 'array',
            'occurred_at'   => 'datetime',
        ];
    }

    public function trustAccount(): BelongsTo
    {
        return $this->belongsTo(ClientTrustAccount::class, 'client_trust_account_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function milestone(): BelongsTo
    {
        return $this->belongsTo(CaseFeeMilestone::class, 'case_fee_milestone_id');
    }
}
