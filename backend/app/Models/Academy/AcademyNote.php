<?php

namespace App\Models\Academy;

class AcademyNote extends AcademyModel
{
    protected $table = 'academy_notes';

    protected $fillable = ['user_id', 'notable_type', 'notable_id', 'body'];
}
