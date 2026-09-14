<?php

namespace App\Models\Academy;

class AcademyLessonCompletion extends AcademyModel
{
    protected $table = 'academy_lesson_completions';

    protected $fillable = ['user_id', 'lesson_id', 'course_version_id', 'completed_at'];

    protected function casts(): array
    {
        return ['completed_at' => 'datetime'];
    }
}
