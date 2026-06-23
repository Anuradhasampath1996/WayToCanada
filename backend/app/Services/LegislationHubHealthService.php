<?php

namespace App\Services;

use App\Models\LegislationSyncRun;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LegislationHubHealthService
{
    /** @return array<string, mixed> */
    public function queueHealth(): array
    {
        $driver = (string) config('queue.default', 'sync');
        $pendingJobs = 0;
        $lastFailed = null;

        if ($driver === 'database' && Schema::hasTable('jobs')) {
            $pendingJobs = (int) DB::table('jobs')->count();
        }

        if (Schema::hasTable('failed_jobs')) {
            $row = DB::table('failed_jobs')->orderByDesc('failed_at')->first();
            if ($row) {
                $payload = json_decode($row->payload ?? '{}', true);
                $lastFailed = [
                    'at'      => $row->failed_at,
                    'job'     => $payload['displayName'] ?? 'unknown',
                    'message' => $this->truncateException($row->exception ?? ''),
                ];
            }
        }

        $stuckRun = LegislationSyncRun::query()
            ->whereIn('status', ['pending', 'running'])
            ->orderByDesc('id')
            ->first();

        $workerLikelyActive = true;
        $workerWarning = null;

        if ($driver === 'sync') {
            $workerLikelyActive = false;
            $workerWarning = 'Queue driver is "sync" — batch jobs run inline and may time out. Use database + queue:work for bulk sync.';
        } elseif ($stuckRun && $pendingJobs > 0) {
            $started = $stuckRun->started_at ?? $stuckRun->created_at;
            if ($started && $started->lt(Carbon::now()->subMinutes(3))) {
                $workerLikelyActive = false;
                $workerWarning = 'Jobs are queued but no progress for 3+ minutes — start php artisan queue:work';
            }
        } elseif ($stuckRun?->status === 'pending' && $pendingJobs > 0) {
            $workerLikelyActive = false;
            $workerWarning = 'Sync run is pending with queued jobs — queue worker may not be running.';
        }

        $setupSteps = $driver === 'sync'
            ? [
                'Set QUEUE_CONNECTION=database in backend/.env',
                'php artisan migrate (creates jobs table if missing)',
                'php artisan queue:work (keep this terminal open)',
                'php artisan queue:retry all (optional — retry failed jobs)',
            ]
            : ($workerWarning ? ['php artisan queue:work (keep this terminal open)'] : []);

        return [
            'driver'                => $driver,
            'pending_jobs'          => $pendingJobs,
            'worker_likely_active'  => $workerLikelyActive,
            'worker_warning'        => $workerWarning,
            'setup_steps'           => $setupSteps,
            'last_failed'           => $lastFailed,
            'active_sync_run_id'    => $stuckRun?->id,
            'active_sync_status'    => $stuckRun?->status,
        ];
    }

    private function truncateException(string $exception): string
    {
        $line = strtok($exception, "\n") ?: $exception;

        return mb_substr(trim($line), 0, 240);
    }
}
