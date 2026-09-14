<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyAiUsageRecord extends AcademyModel
{
    protected $table = 'academy_ai_usage_records';

    protected $fillable = [
        'generation_job_id', 'step_id', 'provider', 'operation', 'model', 'prompt_version',
        'provider_request_id', 'provider_task_id', 'input_tokens', 'output_tokens',
        'estimated_cost_usd', 'actual_cost_usd', 'cost_is_estimated', 'meta_json',
    ];

    protected function casts(): array
    {
        return [
            'cost_is_estimated' => 'boolean',
            'estimated_cost_usd' => 'float',
            'actual_cost_usd' => 'float',
            'meta_json' => 'array',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(AcademyAiGenerationJob::class, 'generation_job_id');
    }
}
