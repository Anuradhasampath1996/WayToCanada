<?php

namespace App\Models\CourseFactory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CfResearchSource extends Model
{
    protected $connection = 'lms';
    protected $table = 'cf_research_sources';

    protected $fillable = [
        'generation_run_id', 'course_id', 'title', 'url', 'organization', 'source_type',
        'authority_tier', 'published_on', 'updated_on', 'accessed_at', 'research_notes',
        'relevant_topics', 'verified',
    ];

    protected function casts(): array
    {
        return [
            'relevant_topics' => 'array',
            'verified' => 'boolean',
            'published_on' => 'date',
            'updated_on' => 'date',
            'accessed_at' => 'datetime',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(CfGenerationRun::class, 'generation_run_id');
    }
}
