<?php

namespace App\Models\Academy;

class AcademyAiManusEvent extends AcademyModel
{
    protected $table = 'academy_ai_manus_events';

    protected $fillable = [
        'event_key', 'task_id', 'request_id', 'status', 'payload_json', 'processed_at',
    ];

    protected function casts(): array
    {
        return [
            'payload_json' => 'array',
            'processed_at' => 'datetime',
        ];
    }
}
