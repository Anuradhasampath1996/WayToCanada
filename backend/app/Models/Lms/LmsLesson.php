<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LmsLesson extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_lessons';

    protected $fillable = [
        'module_id', 'title', 'lesson_type', 'video_url', 'pdf_url', 'text_content', 'duration_minutes', 'sort_order',
        'evidence_mapping_json', 'objectives_json', 'references_json', 'ai_metadata_json', 'last_ai_verified_at',
    ];

    protected function casts(): array
    {
        return [
            'evidence_mapping_json' => 'array',
            'objectives_json' => 'array',
            'references_json' => 'array',
            'ai_metadata_json' => 'array',
            'last_ai_verified_at' => 'datetime',
        ];
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(LmsModule::class, 'module_id');
    }
}
