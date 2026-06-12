<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LmsLesson extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_lessons';

    protected $fillable = [
        'module_id', 'title', 'lesson_type', 'video_url', 'pdf_url', 'text_content', 'duration_minutes', 'sort_order',
    ];

    public function module(): BelongsTo
    {
        return $this->belongsTo(LmsModule::class, 'module_id');
    }
}
