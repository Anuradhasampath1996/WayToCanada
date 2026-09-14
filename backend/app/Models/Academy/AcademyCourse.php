<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademyCourse extends AcademyModel
{
    protected $table = 'academy_courses';

    protected $fillable = [
        'track_id', 'title', 'slug', 'description', 'thumbnail_url', 'category',
        'difficulty', 'estimated_hours', 'access_tier', 'status',
        'current_published_version_id', 'last_reviewed_at', 'legal_reviewer_user_id', 'created_by',
        'exam_id', 'subtitle', 'price_cents', 'currency', 'access_months', 'commerce_confirmed',
        'content_language', 'is_preview', 'featured', 'variant_of_course_id', 'suggested_price_cents',
    ];

    protected function casts(): array
    {
        return [
            'estimated_hours' => 'float',
            'last_reviewed_at' => 'datetime',
            'commerce_confirmed' => 'boolean',
            'is_preview' => 'boolean',
            'featured' => 'boolean',
        ];
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(AcademyLearningTrack::class, 'track_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(AcademyCourseVersion::class, 'course_id');
    }

    public function publishedVersion(): BelongsTo
    {
        return $this->belongsTo(AcademyCourseVersion::class, 'current_published_version_id');
    }

    public function translations(): HasMany
    {
        return $this->hasMany(AcademyCourseTranslation::class, 'course_id');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published' && $this->current_published_version_id;
    }
}
