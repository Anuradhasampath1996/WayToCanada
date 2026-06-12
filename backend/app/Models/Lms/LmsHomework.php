<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LmsHomework extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_homework';

    protected $fillable = [
        'course_id', 'module_id', 'title', 'instructions', 'max_score', 'sort_order',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(LmsCourse::class, 'course_id');
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(LmsModule::class, 'module_id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(LmsHomeworkSubmission::class, 'homework_id');
    }
}
