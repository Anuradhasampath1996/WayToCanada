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
    ];

    protected function casts(): array
    {
        return ['is_published' => 'boolean'];
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
