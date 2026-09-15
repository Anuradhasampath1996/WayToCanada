<?php

namespace App\Models\CourseFactory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CfGenerationEvent extends Model
{
    protected $connection = 'lms';
    protected $table = 'cf_generation_events';

    protected $fillable = [
        'generation_run_id', 'event_type', 'level', 'title', 'message', 'agent', 'payload',
    ];

    protected function casts(): array
    {
        return ['payload' => 'array'];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(CfGenerationRun::class, 'generation_run_id');
    }
}
