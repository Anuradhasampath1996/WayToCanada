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
        // Prefer "(N / M)" counters from search pages or enrich profiles.
        if (preg_match('/page\s+(\d+)\s*\/\s*(\d+)/i', (string) $this->current_step, $m)) {
            $page = max(0, (int) $m[1]);
            $pageTotal = max(1, (int) $m[2]);
            $queriesDone = max(0, (int) $this->completed_steps);
            $queryTotal = max(1, (int) $this->total_steps);
            $fraction = ($queriesDone + min(1, $page / $pageTotal)) / $queryTotal;

            return (int) min(100, round($fraction * 100));
        }

        // "Enriching profile 123 (45 / 14509)" or "Enriching Licensee Details (0 / 100)…"
        if (preg_match('/\((\d+)\s*\/\s*(\d+)\)/', (string) $this->current_step, $m)) {
            $n = max(0, (int) $m[1]);
            $total = max(1, (int) $m[2]);
            $pct = ($n / $total) * 100;
            if ($n > 0 && $pct < 1) {
                return 1; // show bar movement before 1%
            }

            return (int) min(100, round($pct));
        }

        if ($this->total_steps <= 0) {
            return 0;
        }

        return (int) min(100, round(($this->completed_steps / $this->total_steps) * 100));
    }
}
