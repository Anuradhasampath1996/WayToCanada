<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LegislationAmendmentAlert extends Model
{
    protected $fillable = [
        'document_id',
        'act_code',
        'language',
        'format',
        'previous_hash',
        'new_hash',
        'detected_at',
        'acknowledged_at',
        'acknowledged_by',
    ];

    protected function casts(): array
    {
        return [
            'detected_at'      => 'datetime',
            'acknowledged_at'  => 'datetime',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(LegislationDocument::class, 'document_id');
    }
}
