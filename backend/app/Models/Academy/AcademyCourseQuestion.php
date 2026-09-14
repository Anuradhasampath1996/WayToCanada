<?php

namespace App\Models\Academy;

class AcademyCourseQuestion extends AcademyModel
{
    protected $table = 'academy_course_questions';

    protected $fillable = ['course_id', 'question_id', 'practice_eligible', 'mock_eligible'];

    protected function casts(): array
    {
        return [
            'practice_eligible' => 'boolean',
            'mock_eligible' => 'boolean',
        ];
    }
}
