<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyAiSourceSnapshot extends AcademyModel
{
    protected $table = 'academy_ai_source_snapshots';

    protected $fillable = [
        'generation_job_id', 'legal_source_id', 'pack_item_id', 'title', 'url',
        'organization', 'version_label', 'effective_date', 'last_verified_at',
        'retrieved_at', 'content_hash', 'storage_disk', 'storage_path', 'excerpt',
        'retrieval_method', 'allowlisted', 'authoritative',
    ];

    protected function casts(): array
    {
        return [
            'effective_date' => 'date',
            'last_verified_at' => 'datetime',
            'retrieved_at' => 'datetime',
            'allowlisted' => 'boolean',
            'authoritative' => 'boolean',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(AcademyAiGenerationJob::class, 'generation_job_id');
    }
}
