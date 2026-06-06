<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ClientProfile extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'user_id',
        'consultant_id',
        'phone',
        'passport_number',
        'immigration_pathway',
        'family_id',
        'notes',
        'notes_updated_at',
        'invited_at',
    ];

    protected function casts(): array
    {
        return [
            'invited_at'       => 'datetime',
            'notes_updated_at' => 'datetime',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────────────────

    /** The portal user account for this client. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** The consultant who manages this client. */
    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consultant_id');
    }

    /** The case file for this client. */
    public function caseFile(): HasOne
    {
        return $this->hasOne(CaseFile::class);
    }

    // ── Scopes ─────────────────────────────────────────────────────────────────

    /** Filter to a specific consultant's client list. */
    public function scopeForConsultant($query, int $consultantId)
    {
        return $query->where('consultant_id', $consultantId);
    }
}
