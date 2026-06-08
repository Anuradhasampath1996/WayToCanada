<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuestionnaireSubmission extends Model
{
    protected $connection = 'cws';

    protected $fillable = [
        'user_id',
        'step1_data',
        'main_data',
        'spouse_data',
        'children_data',
        'accompanying_data',
        'verified_fields',
        'field_remarks',
        'is_submitted',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'step1_data'        => 'array',
            'main_data'         => 'array',
            'spouse_data'       => 'array',
            'children_data'     => 'array',
            'accompanying_data' => 'array',
            'verified_fields'   => 'array',
            'field_remarks'     => 'array',
            'is_submitted'      => 'boolean',
            'submitted_at'      => 'datetime',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
