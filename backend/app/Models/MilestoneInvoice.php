<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MilestoneInvoice extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'case_fee_milestone_id',
        'client_trust_account_id',
        'case_file_id',
        'client_profile_id',
        'consultant_id',
        'invoice_number',
        'amount',
        'currency',
        'status',
        'consultant_notes',
        'client_approved_at',
        'released_at',
        'released_by',
        'ledger_release_entry_id',
    ];

    protected function casts(): array
    {
        return [
            'amount'             => 'decimal:2',
            'client_approved_at' => 'datetime',
            'released_at'        => 'datetime',
        ];
    }

    public function milestone(): BelongsTo
    {
        return $this->belongsTo(CaseFeeMilestone::class, 'case_fee_milestone_id');
    }

    public function trustAccount(): BelongsTo
    {
        return $this->belongsTo(ClientTrustAccount::class, 'client_trust_account_id');
    }

    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consultant_id');
    }
}
