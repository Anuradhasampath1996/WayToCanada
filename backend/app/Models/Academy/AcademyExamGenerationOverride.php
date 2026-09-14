<?php

namespace App\Models\Academy;

class AcademyExamGenerationOverride extends AcademyModel
{
    protected $table = 'academy_exam_generation_overrides';

    protected $fillable = ['exam_id', 'actor_user_id', 'warning_code', 'reason'];
}
