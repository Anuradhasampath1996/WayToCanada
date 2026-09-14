<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyAiMedia extends AcademyModel
{
    protected $table = 'academy_ai_media';

    protected $fillable = [
        'generation_job_id', 'kind', 'prompt', 'provider', 'model', 'storage_disk',
        'storage_path', 'approval_status', 'associated_type', 'associated_id',
        'estimated_cost_usd', 'generated_at', 'approved_by', 'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'generated_at' => 'datetime',
            'approved_at' => 'datetime',
            'estimated_cost_usd' => 'float',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(AcademyAiGenerationJob::class, 'generation_job_id');
    }
}
