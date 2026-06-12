<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LmsQuizBankQuestion extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_quiz_bank_questions';

    protected $fillable = ['quiz_id', 'bank_question_id', 'sort_order'];

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(LmsQuiz::class, 'quiz_id');
    }

    public function bankQuestion(): BelongsTo
    {
        return $this->belongsTo(LmsQuestionBank::class, 'bank_question_id');
    }
}
