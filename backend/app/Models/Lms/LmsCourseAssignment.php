<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LmsCourseAssignment extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_course_assignments';

    protected $fillable = [
        'course_id', 'client_user_id', 'assigned_by_user_id',
        'progress_percent', 'status', 'assigned_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'assigned_at'  => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(LmsCourse::class, 'course_id');
    }

    public function clientUser(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'client_user_id');
    }

    public function lessonCompletions(): HasMany
    {
        return $this->hasMany(LmsLessonCompletion::class, 'assignment_id');
    }

    public function quizAttempts(): HasMany
    {
        return $this->hasMany(LmsQuizAttempt::class, 'assignment_id');
    }
}
