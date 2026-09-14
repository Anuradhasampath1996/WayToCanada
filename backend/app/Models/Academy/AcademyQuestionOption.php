<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyQuestionOption extends AcademyModel
{
    protected $table = 'academy_question_options';

    protected $fillable = [
        'question_version_id', 'option_key', 'option_text', 'is_correct', 'incorrect_explanation', 'sort_order',
    ];

    protected function casts(): array
    {
        return ['is_correct' => 'boolean'];
    }

    public function version(): BelongsTo
    {
        return $this->belongsTo(AcademyQuestionVersion::class, 'question_version_id');
    }
}
