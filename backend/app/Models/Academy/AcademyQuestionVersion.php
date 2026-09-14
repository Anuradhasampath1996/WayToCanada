<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademyQuestionVersion extends AcademyModel
{
    protected $table = 'academy_question_versions';

    protected $fillable = [
        'question_id', 'version_number', 'question_text', 'explanation', 'difficulty',
        'case_version_id', 'status', 'effective_from', 'effective_to', 'last_verified_at',
        'needs_legal_review', 'source_outdated', 'source_changed', 'author_user_id',
        'reviewer_user_id', 'approved_by', 'reviewed_at', 'approved_at', 'published_at',
        'generated_by_ai', 'ai_generation_job_id', 'ai_prompt_version',
        'provenance_json', 'evidence_item_ids_json', 'validation_flags_json',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
            'effective_to' => 'date',
            'last_verified_at' => 'datetime',
            'needs_legal_review' => 'boolean',
            'source_outdated' => 'boolean',
            'source_changed' => 'boolean',
            'reviewed_at' => 'datetime',
            'approved_at' => 'datetime',
            'published_at' => 'datetime',
            'generated_by_ai' => 'boolean',
            'provenance_json' => 'array',
            'evidence_item_ids_json' => 'array',
            'validation_flags_json' => 'array',
        ];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(AcademyQuestion::class, 'question_id');
    }

    public function options(): HasMany
    {
        return $this->hasMany(AcademyQuestionOption::class, 'question_version_id')->orderBy('sort_order');
    }

    public function caseVersion(): BelongsTo
    {
        return $this->belongsTo(AcademyCaseVersion::class, 'case_version_id');
    }

    public function topics(): BelongsToMany
    {
        return $this->belongsToMany(AcademyTopic::class, 'academy_question_topics', 'question_version_id', 'topic_id');
    }

    public function competencies(): BelongsToMany
    {
        return $this->belongsToMany(AcademyCompetency::class, 'academy_question_competencies', 'question_version_id', 'competency_id');
    }
}
