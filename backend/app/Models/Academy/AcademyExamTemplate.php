<?php

namespace App\Models\Academy;

class AcademyExamTemplate extends AcademyModel
{
    protected $table = 'academy_exam_templates';

    protected $fillable = [
        'track_id', 'name', 'slug', 'description', 'total_questions', 'duration_minutes',
        'independent_count', 'case_based_count', 'topic_mix_json', 'difficulty_mix_json',
        'randomize_questions', 'randomize_options', 'allow_navigation', 'allow_review',
        'pass_threshold_percent', 'readiness_threshold_percent', 'max_attempts',
        'status', 'version_number', 'created_by', 'exam_id', 'course_id', 'selection_mode',
        'fixed_question_version_ids_json', 'competency_mix_json', 'section_mix_json',
        'group_case_questions', 'allow_answer_review_after_submit', 'allow_fallback_mix',
        'content_language',
    ];

    protected function casts(): array
    {
        return [
            'topic_mix_json' => 'array',
            'difficulty_mix_json' => 'array',
            'randomize_questions' => 'boolean',
            'randomize_options' => 'boolean',
            'allow_navigation' => 'boolean',
            'allow_review' => 'boolean',
            'group_case_questions' => 'boolean',
            'allow_answer_review_after_submit' => 'boolean',
            'allow_fallback_mix' => 'boolean',
            'fixed_question_version_ids_json' => 'array',
            'competency_mix_json' => 'array',
            'section_mix_json' => 'array',
        ];
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}
