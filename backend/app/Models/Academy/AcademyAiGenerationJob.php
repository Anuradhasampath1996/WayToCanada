<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AcademyAiGenerationJob extends AcademyModel
{
    protected $table = 'academy_ai_generation_jobs';

    protected $fillable = [
        'type', 'status', 'requested_by', 'track_id', 'exam_template_id', 'course_id',
        'course_version_id', 'title', 'goal', 'difficulty', 'estimated_hours',
        'request_json', 'blueprint_json', 'blueprint_approved', 'progress_json',
        'research_provider', 'generation_provider', 'error', 'cancel_requested',
        'started_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'request_json' => 'array',
            'blueprint_json' => 'array',
            'progress_json' => 'array',
            'blueprint_approved' => 'boolean',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function steps(): HasMany
    {
        return $this->hasMany(AcademyAiGenerationStep::class, 'generation_job_id');
    }

    public function sourcePack(): HasOne
    {
        return $this->hasOne(AcademyAiSourcePack::class, 'generation_job_id');
    }

    public function snapshots(): HasMany
    {
        return $this->hasMany(AcademyAiSourceSnapshot::class, 'generation_job_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(AcademyAiGeneratedItem::class, 'generation_job_id');
    }

    public function usageRecords(): HasMany
    {
        return $this->hasMany(AcademyAiUsageRecord::class, 'generation_job_id');
    }

    public function media(): HasMany
    {
        return $this->hasMany(AcademyAiMedia::class, 'generation_job_id');
    }

    public function isCancelled(): bool
    {
        return $this->status === 'cancelled' || $this->cancel_requested === 'yes';
    }
}
