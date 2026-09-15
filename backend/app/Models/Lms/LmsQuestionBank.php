<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LmsQuestionBank extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_question_bank';

    protected $fillable = [
        'course_id', 'question_text', 'topic', 'difficulty', 'explanation', 'sort_order',
        'module_id', 'lesson_id', 'competency', 'domain', 'subtopic', 'question_type', 'status',
        'distractor_explanations_json', 'source_references_json', 'generation_run_id',
        'content_hash', 'verification_status', 'last_verified_at', 'ai_metadata_json',
    ];

    protected function casts(): array
    {
        return [
            'distractor_explanations_json' => 'array',
            'source_references_json' => 'array',
            'ai_metadata_json' => 'array',
            'last_verified_at' => 'datetime',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(LmsCourse::class, 'course_id');
    }

    public function options(): HasMany
    {
        return $this->hasMany(LmsQuestionBankOption::class, 'bank_question_id')->orderBy('sort_order');
    }
}
