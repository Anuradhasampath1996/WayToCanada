<?php

namespace App\Models\Academy;

class AcademyLearningProgress extends AcademyModel
{
    protected $table = 'academy_learning_progress';

    protected $fillable = [
        'user_id', 'course_id', 'course_version_id', 'status', 'completion_percent',
        'last_lesson_id', 'started_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'completion_percent' => 'float',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }
}
