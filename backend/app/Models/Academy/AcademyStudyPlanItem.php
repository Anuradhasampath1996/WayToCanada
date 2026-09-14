<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyStudyPlanItem extends AcademyModel
{
    protected $table = 'academy_study_plan_items';

    protected $fillable = [
        'plan_id', 'week_number', 'topic_id', 'title', 'planned_minutes', 'completed_minutes', 'due_on', 'status',
    ];

    protected function casts(): array
    {
        return ['due_on' => 'date'];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(AcademyStudyPlan::class, 'plan_id');
    }
}
