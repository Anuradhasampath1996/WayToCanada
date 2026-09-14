<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class AcademyLesson extends AcademyModel
{
    protected $table = 'academy_lessons';

    protected $fillable = [
        'module_id', 'title', 'lesson_type', 'body_html', 'media_url', 'media_disk',
        'duration_minutes', 'sort_order', 'quiz_spec_json',
        'generated_by_ai', 'ai_generation_job_id', 'ai_prompt_version',
    ];

    protected function casts(): array
    {
        return [
            'quiz_spec_json' => 'array',
            'generated_by_ai' => 'boolean',
        ];
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(AcademyModule::class, 'module_id');
    }

    public function topics(): BelongsToMany
    {
        return $this->belongsToMany(AcademyTopic::class, 'academy_lesson_topics', 'lesson_id', 'topic_id');
    }

    public function competencies(): BelongsToMany
    {
        return $this->belongsToMany(AcademyCompetency::class, 'academy_lesson_competencies', 'lesson_id', 'competency_id');
    }
}
