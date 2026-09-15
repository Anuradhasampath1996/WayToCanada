<?php

namespace App\Models\CourseFactory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CfExamBlueprint extends Model
{
    protected $connection = 'lms';
    protected $table = 'cf_exam_blueprints';

    protected $fillable = [
        'generation_run_id', 'course_id', 'exam_name', 'regulator', 'target_candidate',
        'question_count', 'duration_minutes', 'question_formats', 'has_case_questions',
        'domains', 'competencies', 'legislation_topics', 'difficulty_expectations',
        'official_references', 'knowledge_cutoff_policy', 'source_confidence',
        'unknown_fields', 'raw_json', 'last_verified_at',
    ];

    protected function casts(): array
    {
        return [
            'question_formats' => 'array',
            'has_case_questions' => 'boolean',
            'domains' => 'array',
            'competencies' => 'array',
            'legislation_topics' => 'array',
            'difficulty_expectations' => 'array',
            'official_references' => 'array',
            'unknown_fields' => 'array',
            'raw_json' => 'array',
            'last_verified_at' => 'datetime',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(CfGenerationRun::class, 'generation_run_id');
    }
}
