<?php

namespace App\Models\Academy;

class AcademyCompetency extends AcademyModel
{
    protected $table = 'academy_competencies';

    protected $fillable = ['key', 'name', 'description', 'sort_order', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
