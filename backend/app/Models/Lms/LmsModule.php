<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LmsModule extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_modules';

    protected $fillable = ['course_id', 'title', 'sort_order'];

    public function course(): BelongsTo
    {
        return $this->belongsTo(LmsCourse::class, 'course_id');
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(LmsLesson::class, 'module_id')->orderBy('sort_order');
    }
}
