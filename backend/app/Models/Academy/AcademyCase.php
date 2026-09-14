<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademyCase extends AcademyModel
{
    protected $table = 'academy_cases';

    protected $fillable = ['track_id', 'title', 'slug', 'status', 'current_published_version_id', 'created_by'];

    public function versions(): HasMany
    {
        return $this->hasMany(AcademyCaseVersion::class, 'case_id');
    }

    public function publishedVersion(): BelongsTo
    {
        return $this->belongsTo(AcademyCaseVersion::class, 'current_published_version_id');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published' && $this->current_published_version_id;
    }
}
