<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LmsAiSourceSnapshot extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_ai_source_snapshots';

    protected $fillable = [
        'generation_job_id', 'evidence_item_id', 'title', 'url', 'organization',
        'version_label', 'retrieved_at', 'content_hash', 'excerpt', 'retrieval_method',
        'allowlisted', 'authoritative', 'candidate_only',
    ];

    protected function casts(): array
    {
        return [
            'retrieved_at' => 'datetime',
            'allowlisted' => 'boolean',
            'authoritative' => 'boolean',
            'candidate_only' => 'boolean',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(LmsAiGenerationJob::class, 'generation_job_id');
    }
}
