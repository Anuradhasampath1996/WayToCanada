<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyAiGenerationStep extends AcademyModel
{
    protected $table = 'academy_ai_generation_steps';

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
        return $this->belongsTo(AcademyAiGenerationJob::class, 'generation_job_id');
    }
}
