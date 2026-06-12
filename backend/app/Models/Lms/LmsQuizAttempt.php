<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LmsQuizAttempt extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_quiz_attempts';

    protected $fillable = [
        'assignment_id', 'quiz_id', 'score_percent', 'passed',
        'answers_json', 'questions_snapshot_json', 'time_taken_seconds', 'attempted_at',
    ];

    protected function casts(): array
    {
        return [
            'passed'                  => 'boolean',
            'answers_json'            => 'array',
            'questions_snapshot_json' => 'array',
            'attempted_at'            => 'datetime',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(LmsCourseAssignment::class, 'assignment_id');
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(LmsQuiz::class, 'quiz_id');
    }
}
