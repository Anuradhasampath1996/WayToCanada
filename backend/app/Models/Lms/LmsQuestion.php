<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LmsQuestion extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_questions';

    protected $fillable = ['quiz_id', 'question_text', 'sort_order'];

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(LmsQuiz::class, 'quiz_id');
    }

    public function options(): HasMany
    {
        return $this->hasMany(LmsQuestionOption::class, 'question_id')->orderBy('sort_order');
    }
}
