<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LmsAiUsageRecord extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_ai_usage_records';

    protected $fillable = [
        'generation_job_id', 'step_id', 'provider', 'operation', 'model', 'prompt_version',
        'provider_request_id', 'provider_task_id', 'input_tokens', 'output_tokens',
        'estimated_cost_usd', 'cost_is_estimated', 'meta_json',
    ];

    protected function casts(): array
    {
        return [
            'cost_is_estimated' => 'boolean',
            'meta_json' => 'array',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(LmsAiGenerationJob::class, 'generation_job_id');
    }
}
