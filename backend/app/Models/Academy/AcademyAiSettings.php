<?php

namespace App\Models\Academy;

class AcademyAiSettings extends AcademyModel
{
    protected $table = 'academy_ai_settings';

    protected $fillable = [
        'monthly_budget_usd', 'max_questions_per_job', 'max_source_chars', 'batch_size',
        'image_limit_per_job', 'budget_warn_percent', 'manus_enabled_override',
        'allowed_models_json',
    ];

    protected function casts(): array
    {
        return [
            'monthly_budget_usd' => 'float',
            'manus_enabled_override' => 'boolean',
            'allowed_models_json' => 'array',
        ];
    }
}
