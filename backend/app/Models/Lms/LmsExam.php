<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class LmsExam extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_exams';

    protected $fillable = [
        'product_domain', 'audience', 'key', 'slug', 'generation_profile', 'name', 'description',
        'exam_authority', 'official_exam_url', 'content_language', 'category_id', 'status',
        'thumbnail_url', 'exam_format_json', 'source_requirements_json',
        'structure_verification_status', 'structure_entered_by', 'structure_entered_at',
        'structure_entered_reason', 'structure_supporting_url', 'last_verified_at',
        'next_review_at', 'stale_reason', 'verification_interval_days', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'exam_format_json' => 'array',
            'source_requirements_json' => 'array',
            'structure_entered_at' => 'datetime',
            'last_verified_at' => 'datetime',
            'next_review_at' => 'datetime',
        ];
    }

    public function evidencePacks(): HasMany
    {
        return $this->hasMany(LmsExamEvidencePack::class, 'exam_id');
    }

    public function latestEvidencePack(): HasOne
    {
        return $this->hasOne(LmsExamEvidencePack::class, 'exam_id')->latestOfMany();
    }

    public function fieldAudits(): HasMany
    {
        return $this->hasMany(LmsExamFieldAudit::class, 'exam_id');
    }
}
