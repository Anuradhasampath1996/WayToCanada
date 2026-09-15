<?php

namespace App\Models\CourseFactory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use App\Models\Lms\LmsCourse;

class CfGenerationRun extends Model
{
    protected $connection = 'lms';
    protected $table = 'cf_generation_runs';

    protected $fillable = [
        'admin_user_id', 'course_id', 'exam_name', 'canonical_exam_name', 'status',
        'overall_progress', 'current_step', 'config_snapshot', 'provider_metadata',
        'research_json', 'verification_json', 'coverage_report_json', 'stats_json',
        'error_summary', 'research_version', 'generation_version',
        'started_at', 'completed_at', 'failed_at', 'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'config_snapshot' => 'array',
            'provider_metadata' => 'array',
            'research_json' => 'array',
            'verification_json' => 'array',
            'coverage_report_json' => 'array',
            'stats_json' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'failed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function steps(): HasMany
    {
        return $this->hasMany(CfGenerationStep::class, 'generation_run_id')->orderBy('sequence');
    }

    public function events(): HasMany
    {
        return $this->hasMany(CfGenerationEvent::class, 'generation_run_id')->orderByDesc('id');
    }

    public function sources(): HasMany
    {
        return $this->hasMany(CfResearchSource::class, 'generation_run_id');
    }

    public function blueprint(): HasOne
    {
        return $this->hasOne(CfExamBlueprint::class, 'generation_run_id');
    }

    public function mockBlueprint(): HasOne
    {
        return $this->hasOne(CfMockExamBlueprint::class, 'generation_run_id');
    }

    public function course()
    {
        return $this->belongsTo(LmsCourse::class, 'course_id');
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, ['pending_review', 'failed', 'cancelled', 'generation_incomplete'], true);
    }
}
