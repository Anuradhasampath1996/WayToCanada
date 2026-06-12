<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CaseFeeMilestone extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'case_file_id',
        'client_profile_id',
        'milestone_key',
        'label',
        'percentage',
        'amount',
        'currency',
        'status',
        'completed_at',
        'completed_by',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'amount'       => 'decimal:2',
            'percentage'   => 'integer',
            'completed_at' => 'datetime',
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

    public function completedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(MilestoneInvoice::class);
    }
}
