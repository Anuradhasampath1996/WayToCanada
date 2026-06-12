<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LmsHomeworkSubmission extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_homework_submissions';

    protected $fillable = [
        'homework_id', 'assignment_id', 'content', 'score', 'status', 'feedback', 'submitted_at',
    ];

    protected function casts(): array
    {
        return ['submitted_at' => 'datetime'];
    }

    public function homework(): BelongsTo
    {
        return $this->belongsTo(LmsHomework::class, 'homework_id');
    }

    public function courseAssignment(): BelongsTo
    {
        return $this->belongsTo(LmsCourseAssignment::class, 'assignment_id');
    }
}
