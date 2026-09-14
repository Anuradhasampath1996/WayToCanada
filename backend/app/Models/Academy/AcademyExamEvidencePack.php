<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademyExamEvidencePack extends AcademyModel
{
    protected $table = 'academy_exam_evidence_packs';

    protected $fillable = [
        'exam_id', 'product_domain', 'researched_at', 'research_provider', 'last_verified_at',
        'next_review_at', 'stale_reason', 'source_count', 'official_source_count',
        'official_sample_paper_count', 'public_past_paper_count', 'blueprint_found',
        'syllabus_found', 'competency_framework_found', 'exam_structure_verified',
        'critical_structure_unverified', 'current_format_confidence', 'unresolved_conflict_count',
        'unresolved_conflicts_json', 'research_summary', 'status', 'manus_research_json',
        'openai_verification_json', 'coverage_json', 'pattern_metadata_json',
        'approved_at', 'approved_by',
    ];

    protected function casts(): array
    {
        return [
            'researched_at' => 'datetime',
            'last_verified_at' => 'datetime',
            'next_review_at' => 'datetime',
            'approved_at' => 'datetime',
            'blueprint_found' => 'boolean',
            'syllabus_found' => 'boolean',
            'competency_framework_found' => 'boolean',
            'exam_structure_verified' => 'boolean',
            'critical_structure_unverified' => 'boolean',
            'unresolved_conflicts_json' => 'array',
            'manus_research_json' => 'array',
            'openai_verification_json' => 'array',
            'coverage_json' => 'array',
            'pattern_metadata_json' => 'array',
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(AcademyExam::class, 'exam_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(AcademyExamEvidenceItem::class, 'pack_id');
    }

    public function isApproved(): bool
    {
        return $this->approved_at !== null && $this->status !== 'source_conflict';
    }
}
