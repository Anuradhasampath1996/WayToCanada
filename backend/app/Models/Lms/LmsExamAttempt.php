<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LmsExamAttempt extends Model
{
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_EXPIRED_SUBMITTED = 'expired_submitted';

    protected $connection = 'lms';

    protected $table = 'lms_exam_attempts';

    protected $fillable = [
        'user_id', 'exam_template_id', 'exam_template_version', 'started_at', 'expires_at',
        'submitted_at', 'duration_seconds', 'status', 'submission_reason', 'score_percent',
        'unanswered_count', 'topic_scores_json', 'competency_scores_json', 'question_set_json',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'expires_at' => 'datetime',
            'submitted_at' => 'datetime',
            'topic_scores_json' => 'array',
            'competency_scores_json' => 'array',
            'question_set_json' => 'array',
        ];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(LmsExamTemplate::class, 'exam_template_id');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(LmsExamAttemptAnswer::class, 'attempt_id');
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
