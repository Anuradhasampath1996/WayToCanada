<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LegislationSyncRun extends Model
{
    protected $fillable = [
        'status', 'scope', 'source_slug', 'total_steps', 'completed_steps',
        'current_step', 'stats', 'error_message', 'started_at', 'finished_at',
    ];

    protected $casts = [
        'stats'      => 'array',
        'started_at' => 'datetime',
        'finished_at'=> 'datetime',
    ];

    public function progressPercent(): int
    {
        if ($this->total_steps <= 0) {
            return 0;
        }

        return (int) round(($this->completed_steps / $this->total_steps) * 100);
    }
}
