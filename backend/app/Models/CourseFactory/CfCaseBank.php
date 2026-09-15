<?php

namespace App\Models\CourseFactory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CfCaseBank extends Model
{
    protected $connection = 'lms';
    protected $table = 'cf_case_bank';

    protected $fillable = [
        'generation_run_id', 'course_id', 'case_key', 'title', 'profile_json',
        'timeline_json', 'facts_json', 'issues_json', 'question_ids', 'status',
    ];

    protected function casts(): array
    {
        return [
            'profile_json' => 'array',
            'timeline_json' => 'array',
            'facts_json' => 'array',
            'issues_json' => 'array',
            'question_ids' => 'array',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(CfGenerationRun::class, 'generation_run_id');
    }
}
