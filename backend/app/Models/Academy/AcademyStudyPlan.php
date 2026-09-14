<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademyStudyPlan extends AcademyModel
{
    protected $table = 'academy_study_plans';

    protected $fillable = [
        'user_id', 'track_id', 'exam_template_id', 'exam_date', 'weekly_hours',
        'preferred_days_json', 'generated_weeks_json', 'status',
    ];

    protected function casts(): array
    {
        return [
            'exam_date' => 'date',
            'preferred_days_json' => 'array',
            'generated_weeks_json' => 'array',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(AcademyStudyPlanItem::class, 'plan_id')->orderBy('week_number');
    }
}
