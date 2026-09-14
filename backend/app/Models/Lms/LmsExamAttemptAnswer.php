<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LmsExamAttemptAnswer extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_exam_attempt_answers';

    protected $fillable = [
        'attempt_id', 'question_id', 'question_version_id', 'selected_option_id',
        'is_correct', 'time_spent_seconds', 'flagged', 'answered_at',
    ];

    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
            'flagged' => 'boolean',
            'answered_at' => 'datetime',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(LmsExamAttempt::class, 'attempt_id');
    }
}
