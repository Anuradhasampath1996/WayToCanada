<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LmsCourse extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_courses';

    protected $fillable = [
        'category_id', 'title', 'slug', 'description', 'thumbnail_url', 'is_published', 'sort_order',
        'exam_id', 'subtitle', 'price_cents', 'currency', 'access_months', 'access_mode', 'audience',
        'commerce_confirmed', 'content_language', 'review_status', 'is_preview', 'featured',
        'variant_of_course_id', 'generation_job_id', 'short_description', 'learning_objectives_json',
        'estimated_hours', 'difficulty', 'regulator', 'tags_json', 'seo_json', 'cf_generation_run_id',
    ];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'commerce_confirmed' => 'boolean',
            'is_preview' => 'boolean',
            'featured' => 'boolean',
            'learning_objectives_json' => 'array',
            'tags_json' => 'array',
            'seo_json' => 'array',
        ];
    }

    public function scopeForConsultants($query)
    {
        return $query->where('audience', 'consultant');
    }

    public function scopeForClients($query)
    {
        return $query->where(function ($q) {
            $q->where('audience', 'client')->orWhereNull('audience');
        });
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(LmsCategory::class, 'category_id');
    }

    public function modules(): HasMany
    {
        return $this->hasMany(LmsModule::class, 'course_id')->orderBy('sort_order');
    }

    public function quizzes(): HasMany
    {
        return $this->hasMany(LmsQuiz::class, 'course_id')->orderBy('sort_order');
    }

    public function questionBank(): HasMany
    {
        return $this->hasMany(LmsQuestionBank::class, 'course_id')->orderBy('sort_order');
    }

    public function homework(): HasMany
    {
        return $this->hasMany(LmsHomework::class, 'course_id')->orderBy('sort_order');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(LmsCourseAssignment::class, 'course_id');
    }
}
