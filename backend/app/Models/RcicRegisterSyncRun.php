<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RcicRegisterSyncRun extends Model
{
    protected $connection = 'cws';

    protected $table = 'rcic_register_sync_runs';

    protected $fillable = [
        'status',
        'trigger',
        'total_steps',
        'completed_steps',
        'current_step',
        'stats',
        'error_message',
        'started_at',
        'finished_at',
    ];

    protected $casts = [
        'stats'       => 'array',
        'started_at'  => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function progressPercent(): int
    {
        if ($this->total_steps <= 0) {
            return 0;
        }

        return (int) round(($this->completed_steps / $this->total_steps) * 100);
    }
}
