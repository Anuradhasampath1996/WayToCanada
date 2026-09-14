<?php

namespace App\Models\Academy;

class AcademyExamFieldAudit extends AcademyModel
{
    protected $table = 'academy_exam_field_audits';

    protected $fillable = ['exam_id', 'actor_user_id', 'field', 'previous_value', 'new_value', 'reason'];
}
