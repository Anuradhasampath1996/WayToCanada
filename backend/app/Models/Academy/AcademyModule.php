<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademyModule extends AcademyModel
{
    protected $table = 'academy_modules';

    protected $fillable = ['course_version_id', 'title', 'sort_order'];

    public function courseVersion(): BelongsTo
    {
        return $this->belongsTo(AcademyCourseVersion::class, 'course_version_id');
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(AcademyLesson::class, 'module_id')->orderBy('sort_order');
    }
}
