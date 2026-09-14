<?php

namespace App\Models\Academy;

class AcademyQuestionAttempt extends AcademyModel
{
    protected $table = 'academy_question_attempts';

    protected $fillable = [
        'user_id', 'question_id', 'question_version_id', 'selected_option_id', 'is_correct',
        'time_spent_seconds', 'mode', 'exam_attempt_id', 'practice_session_id', 'confidence', 'attempted_at',
    ];

    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
            'attempted_at' => 'datetime',
        ];
    }
}
