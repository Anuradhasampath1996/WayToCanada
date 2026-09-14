<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LmsAiGenerationJob extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_ai_generation_jobs';

    protected $fillable = [
        'type', 'status', 'requested_by', 'exam_id', 'evidence_pack_id', 'course_id',
        'generation_profile', 'product_domain', 'content_language', 'title', 'goal',
        'request_json', 'blueprint_json', 'blueprint_approved', 'progress_json',
        'coverage_json', 'manus_research_json', 'openai_verification_json',
        'research_provider', 'generation_provider', 'error', 'cancel_requested',
        'started_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'request_json' => 'array',
            'blueprint_json' => 'array',
            'progress_json' => 'array',
            'coverage_json' => 'array',
            'manus_research_json' => 'array',
            'openai_verification_json' => 'array',
            'blueprint_approved' => 'boolean',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function steps(): HasMany
    {
        return $this->hasMany(LmsAiGenerationStep::class, 'generation_job_id');
    }

    public function snapshots(): HasMany
    {
        return $this->hasMany(LmsAiSourceSnapshot::class, 'generation_job_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(LmsAiGeneratedItem::class, 'generation_job_id');
    }

    public function usageRecords(): HasMany
    {
        return $this->hasMany(LmsAiUsageRecord::class, 'generation_job_id');
    }

    public function isCancelled(): bool
    {
        return $this->status === 'cancelled' || $this->cancel_requested === 'yes';
    }

    public function usesCases(): bool
    {
        $profile = (string) $this->generation_profile;
        $meta = config('learning.generation_profiles.'.$profile, []);

        return (bool) ($meta['uses_cases'] ?? false);
    }
}
