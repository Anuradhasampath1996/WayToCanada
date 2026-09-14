<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademyQuestion extends AcademyModel
{
    protected $table = 'academy_questions';

    protected $fillable = ['type', 'status', 'current_published_version_id', 'created_by'];

    public function versions(): HasMany
    {
        return $this->hasMany(AcademyQuestionVersion::class, 'question_id');
    }

    public function publishedVersion(): BelongsTo
    {
        return $this->belongsTo(AcademyQuestionVersion::class, 'current_published_version_id');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published' && $this->current_published_version_id;
    }
}
