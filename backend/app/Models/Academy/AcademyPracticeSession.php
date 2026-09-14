<?php

namespace App\Models\Academy;

class AcademyPracticeSession extends AcademyModel
{
    protected $table = 'academy_practice_sessions';

    protected $fillable = [
        'user_id', 'filters_json', 'question_count', 'explain_mode', 'status',
        'question_set_json', 'started_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'filters_json' => 'array',
            'question_set_json' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }
}
