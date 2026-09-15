<?php

namespace App\Models\CourseFactory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CfGenerationStep extends Model
{
    protected $connection = 'lms';
    protected $table = 'cf_generation_steps';

    protected $fillable = [
        'generation_run_id', 'step_key', 'step_name', 'sequence', 'status', 'progress',
        'retry_count', 'external_provider', 'external_task_id', 'error_code', 'error_message',
        'metadata', 'generated_records_count', 'started_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(CfGenerationRun::class, 'generation_run_id');
    }
}
