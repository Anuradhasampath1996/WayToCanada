<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademyCaseVersion extends AcademyModel
{
    protected $table = 'academy_case_versions';

    protected $fillable = [
        'case_id', 'version_number', 'client_profile_json', 'immigration_history', 'facts',
        'procedural_history', 'tribunal_info', 'legal_issues_json', 'status', 'created_by',
        'reviewed_by', 'approved_by', 'reviewed_at', 'approved_at', 'published_at', 'published_by',
    ];

    protected function casts(): array
    {
        return [
            'client_profile_json' => 'array',
            'legal_issues_json' => 'array',
            'reviewed_at' => 'datetime',
            'approved_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    public function case(): BelongsTo
    {
        return $this->belongsTo(AcademyCase::class, 'case_id');
    }

    public function exhibits(): HasMany
    {
        return $this->hasMany(AcademyCaseExhibit::class, 'case_version_id')->orderBy('sort_order');
    }

    public function questions(): BelongsToMany
    {
        return $this->belongsToMany(AcademyQuestion::class, 'academy_case_questions', 'case_version_id', 'question_id')
            ->withPivot('sort_order')
            ->orderByPivot('sort_order');
    }
}
