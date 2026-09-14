<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyCourseTranslation extends AcademyModel
{
    protected $table = 'academy_course_translations';

    protected $fillable = [
        'course_id', 'locale', 'title', 'subtitle', 'description',
        'outcomes_json', 'translation_status', 'translation_outdated',
    ];

    protected function casts(): array
    {
        return [
            'outcomes_json' => 'array',
            'translation_outdated' => 'boolean',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(AcademyCourse::class, 'course_id');
    }
}
