<?php

namespace App\Models\Academy;

class AcademyLegalSource extends AcademyModel
{
    protected $table = 'academy_legal_sources';

    protected $fillable = [
        'title', 'source_organization', 'source_url', 'source_type', 'citation_label',
        'effective_date', 'last_verified_at', 'version_label', 'status', 'summary',
        'key_points_json', 'legislation_document_id', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'effective_date' => 'date',
            'last_verified_at' => 'datetime',
            'key_points_json' => 'array',
        ];
    }
}
