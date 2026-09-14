<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LmsExamQuestion extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_exam_questions';

    protected $fillable = [
        'exam_id', 'type', 'status', 'current_published_version_id',
        'generation_job_id', 'generation_profile', 'style_pattern_category',
        'practice_eligible', 'mock_eligible', 'content_language', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'practice_eligible' => 'boolean',
            'mock_eligible' => 'boolean',
        ];
    }

    public function versions(): HasMany
    {
        return $this->hasMany(LmsExamQuestionVersion::class, 'question_id');
    }

    public function publishedVersion(): BelongsTo
    {
        return $this->belongsTo(LmsExamQuestionVersion::class, 'current_published_version_id');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published' && $this->current_published_version_id;
    }
}
