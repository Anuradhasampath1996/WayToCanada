<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LmsExamQuestionVersion extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_exam_question_versions';

    protected $fillable = [
        'question_id', 'version_number', 'question_text', 'explanation', 'difficulty',
        'status', 'provenance_json', 'evidence_item_ids_json', 'validation_flags_json',
        'topics_json', 'competencies_json', 'created_by', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'provenance_json' => 'array',
            'evidence_item_ids_json' => 'array',
            'validation_flags_json' => 'array',
            'topics_json' => 'array',
            'competencies_json' => 'array',
            'published_at' => 'datetime',
        ];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(LmsExamQuestion::class, 'question_id');
    }

    public function options(): HasMany
    {
        return $this->hasMany(LmsExamQuestionOption::class, 'question_version_id')->orderBy('sort_order');
    }
}
