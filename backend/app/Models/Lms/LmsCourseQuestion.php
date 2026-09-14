<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;

class LmsCourseQuestion extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_course_questions';

    protected $fillable = [
        'course_id', 'question_id', 'practice_eligible', 'mock_eligible',
    ];

    protected function casts(): array
    {
        return [
            'practice_eligible' => 'boolean',
            'mock_eligible' => 'boolean',
        ];
    }
}
