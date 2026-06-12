<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LmsQuestionBank extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_question_bank';

    protected $fillable = [
        'course_id', 'question_text', 'topic', 'difficulty', 'explanation', 'sort_order',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(LmsCourse::class, 'course_id');
    }

    public function options(): HasMany
    {
        return $this->hasMany(LmsQuestionBankOption::class, 'bank_question_id')->orderBy('sort_order');
    }
}
