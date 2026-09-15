<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LmsModule extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_modules';

    protected $fillable = [
        'course_id', 'title', 'sort_order', 'description', 'objectives_json',
        'competency_map_json', 'study_minutes',
    ];

    protected function casts(): array
    {
        return [
            'objectives_json' => 'array',
            'competency_map_json' => 'array',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(LmsCourse::class, 'course_id');
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(LmsLesson::class, 'module_id')->orderBy('sort_order');
    }
}
