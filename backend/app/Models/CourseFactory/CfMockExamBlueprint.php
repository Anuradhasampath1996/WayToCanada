<?php

namespace App\Models\CourseFactory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CfMockExamBlueprint extends Model
{
    protected $connection = 'lms';
    protected $table = 'cf_mock_exam_blueprints';

    protected $fillable = [
        'generation_run_id', 'course_id', 'question_count', 'duration_minutes',
        'domain_weights', 'difficulty_mix', 'question_type_mix', 'rules_json',
        'strict_simulation', 'status',
    ];

    protected function casts(): array
    {
        return [
            'domain_weights' => 'array',
            'difficulty_mix' => 'array',
            'question_type_mix' => 'array',
            'rules_json' => 'array',
            'strict_simulation' => 'boolean',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(CfGenerationRun::class, 'generation_run_id');
    }
}
