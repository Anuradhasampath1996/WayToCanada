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
        'status', 'version_number', 'created_by',
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
        ];
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}
