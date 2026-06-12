<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LmsQuiz extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_quizzes';

    protected $fillable = [
        'course_id', 'module_id', 'title', 'content_type', 'source_mode',
        'random_question_count', 'time_limit_minutes', 'description',
        'passing_score', 'sort_order',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(LmsCourse::class, 'course_id');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(LmsQuestion::class, 'quiz_id')->orderBy('sort_order');
    }

    public function bankLinks(): HasMany
    {
        return $this->hasMany(LmsQuizBankQuestion::class, 'quiz_id')->orderBy('sort_order');
    }
}
