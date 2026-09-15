<?php

namespace App\Models\CourseFactory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CfUsageRecord extends Model
{
    protected $connection = 'lms';
    protected $table = 'cf_usage_records';

    protected $fillable = [
        'generation_run_id', 'generation_step_id', 'provider', 'model', 'request_count',
        'input_tokens', 'output_tokens', 'image_generations', 'manus_task_count',
        'estimated_cost_usd', 'duration_ms', 'meta',
    ];

    protected function casts(): array
    {
        return [
            'estimated_cost_usd' => 'float',
            'meta' => 'array',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(CfGenerationRun::class, 'generation_run_id');
    }
}
