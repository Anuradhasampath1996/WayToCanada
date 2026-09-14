<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LmsExamTemplate extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_exam_templates';

    protected $fillable = [
        'exam_id', 'course_id', 'name', 'slug', 'description', 'total_questions',
        'duration_minutes', 'independent_count', 'case_based_count',
        'topic_mix_json', 'difficulty_mix_json', 'competency_mix_json', 'section_mix_json',
        'fixed_question_version_ids_json', 'selection_mode', 'randomize_questions',
        'randomize_options', 'allow_navigation', 'allow_review',
        'allow_answer_review_after_submit', 'group_case_questions', 'allow_fallback_mix',
        'pass_threshold_percent', 'max_attempts', 'content_language', 'status',
        'version_number', 'created_by', 'generation_job_id',
    ];

    protected function casts(): array
    {
        return [
            'topic_mix_json' => 'array',
            'difficulty_mix_json' => 'array',
            'competency_mix_json' => 'array',
            'section_mix_json' => 'array',
            'fixed_question_version_ids_json' => 'array',
            'randomize_questions' => 'boolean',
            'randomize_options' => 'boolean',
            'allow_navigation' => 'boolean',
            'allow_review' => 'boolean',
            'allow_answer_review_after_submit' => 'boolean',
            'group_case_questions' => 'boolean',
            'allow_fallback_mix' => 'boolean',
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(LmsExam::class, 'exam_id');
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(LmsCourse::class, 'course_id');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}
