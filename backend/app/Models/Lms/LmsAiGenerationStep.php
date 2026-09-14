<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LmsAiGenerationStep extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_ai_generation_steps';

    protected $fillable = [
        'generation_job_id', 'stage', 'status', 'attempt', 'provider', 'model',
        'prompt_key', 'prompt_version', 'input_ref_json', 'output_ref_json',
        'manus_task_id', 'manus_request_id', 'error', 'started_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'input_ref_json' => 'array',
            'output_ref_json' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(LmsAiGenerationJob::class, 'generation_job_id');
    }
}
