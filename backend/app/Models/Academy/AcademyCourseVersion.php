<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademyCourseVersion extends AcademyModel
{
    protected $table = 'academy_course_versions';

    protected $fillable = [
        'course_id', 'version_number', 'title', 'description', 'estimated_hours', 'status',
        'effective_from', 'effective_to', 'change_notes', 'created_by', 'reviewed_by',
        'approved_by', 'reviewed_at', 'approved_at', 'published_at', 'published_by',
        'generated_by_ai', 'ai_generation_job_id', 'ai_prompt_version',
    ];

    protected function casts(): array
    {
        return [
            'estimated_hours' => 'float',
            'effective_from' => 'date',
            'effective_to' => 'date',
            'reviewed_at' => 'datetime',
            'approved_at' => 'datetime',
            'published_at' => 'datetime',
            'generated_by_ai' => 'boolean',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(AcademyCourse::class, 'course_id');
    }

    public function modules(): HasMany
    {
        return $this->hasMany(AcademyModule::class, 'course_version_id')->orderBy('sort_order');
    }
}
