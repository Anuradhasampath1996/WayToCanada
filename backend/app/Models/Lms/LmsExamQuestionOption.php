<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LmsExamQuestionOption extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_exam_question_options';

    protected $fillable = [
        'question_version_id', 'option_key', 'option_text', 'is_correct',
        'incorrect_explanation', 'sort_order',
    ];

    protected function casts(): array
    {
        return ['is_correct' => 'boolean'];
    }

    public function version(): BelongsTo
    {
        return $this->belongsTo(LmsExamQuestionVersion::class, 'question_version_id');
    }
}
