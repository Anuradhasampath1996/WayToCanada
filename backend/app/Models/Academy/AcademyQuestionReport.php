<?php

namespace App\Models\Academy;

class AcademyQuestionReport extends AcademyModel
{
    protected $table = 'academy_question_reports';

    protected $fillable = [
        'user_id', 'question_id', 'question_version_id', 'reason', 'comment', 'status', 'admin_notes',
    ];
}
