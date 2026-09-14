<?php

namespace App\Models\Academy;

class AcademyOutdatedFlag extends AcademyModel
{
    protected $table = 'academy_outdated_flags';

    protected $fillable = [
        'legal_source_id', 'linkable_type', 'linkable_id', 'reason', 'status',
        'flagged_at', 'resolved_at', 'resolved_by',
    ];

    protected function casts(): array
    {
        return [
            'flagged_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }
}
