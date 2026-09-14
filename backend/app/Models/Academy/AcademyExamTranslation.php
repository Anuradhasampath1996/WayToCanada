<?php

namespace App\Models\Academy;

class AcademyExamTranslation extends AcademyModel
{
    protected $table = 'academy_exam_translations';

    protected $fillable = ['exam_id', 'locale', 'name', 'description'];
}
