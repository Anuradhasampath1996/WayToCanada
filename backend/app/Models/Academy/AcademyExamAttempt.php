<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademyExamAttempt extends AcademyModel
{
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_EXPIRED_SUBMITTED = 'expired_submitted';
    public const STATUS_ABANDONED = 'abandoned';

    protected $table = 'academy_exam_attempts';

    protected $fillable = [
        'user_id', 'exam_template_id', 'exam_template_version', 'started_at', 'expires_at',
        'submitted_at', 'duration_seconds', 'status', 'score_percent', 'independent_score_percent',
        'case_score_percent', 'topic_scores_json', 'competency_scores_json', 'time_analysis_json',
        'readiness_score', 'question_set_json',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'expires_at' => 'datetime',
            'submitted_at' => 'datetime',
            'topic_scores_json' => 'array',
            'competency_scores_json' => 'array',
            'time_analysis_json' => 'array',
            'question_set_json' => 'array',
        ];
    }

    public function answers(): HasMany
    {
        return $this->hasMany(AcademyExamAttemptAnswer::class, 'attempt_id');
    }

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_IN_PROGRESS && $this->expires_at?->isFuture();
    }

    public function isExpired(): bool
    {
        return $this->status === self::STATUS_IN_PROGRESS && $this->expires_at && $this->expires_at->isPast();
    }
}
