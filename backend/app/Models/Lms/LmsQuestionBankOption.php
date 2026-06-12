<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LmsQuestionBankOption extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_question_bank_options';

    protected $fillable = ['bank_question_id', 'option_text', 'is_correct', 'sort_order'];

    protected function casts(): array
    {
        return ['is_correct' => 'boolean'];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(LmsQuestionBank::class, 'bank_question_id');
    }
}
