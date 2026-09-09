<?php

namespace App\Jobs;

use App\Models\RcicRegisterSyncRun;
use App\Services\RcicRegisterSyncService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class RunRcicRegisterSyncJob implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    /** Full register scrape can take many hours with respectful rate limiting. */
    public int $timeout = 28800;

    public int $tries = 1;

    public int $uniqueFor = 28800;

    public function __construct(public int $syncRunId) {}

    public function uniqueId(): string
    {
        return 'rcic-register-sync';
    }

    public function handle(RcicRegisterSyncService $sync): void
    {
        $run = RcicRegisterSyncRun::findOrFail($this->syncRunId);

        if (in_array($run->status, ['cancelled', 'cancel_requested'], true)) {
            if ($run->status === 'cancel_requested') {
                $run->update([
                    'status'       => 'cancelled',
                    'finished_at'  => now(),
                    'current_step' => 'Stopped by admin before start',
                ]);
            }

            return;
        }

        try {
            $sync->runSync($run);
        } catch (\Throwable $e) {
            Log::error('RCIC register sync job failed', [
                'run_id' => $this->syncRunId,
                'error'  => $e->getMessage(),
            ]);

            $run->refresh();
            if (! in_array($run->status, ['completed', 'failed', 'cancelled'], true)) {
                $run->update([
                    'status'        => 'failed',
                    'finished_at'   => now(),
                    'error_message' => $e->getMessage(),
                    'current_step'  => 'Failed',
                ]);
            }

            throw $e;
        }
    }

    public function failed(?\Throwable $e): void
    {
        $run = RcicRegisterSyncRun::find($this->syncRunId);
        if (! $run || in_array($run->status, ['completed', 'failed', 'cancelled'], true)) {
            return;
        }

        $message = $e?->getMessage() ?: 'Queue job failed';
        $run->update([
            'status'        => 'failed',
            'finished_at'   => now(),
            'error_message' => $message,
            'current_step'  => 'Failed — queue worker stopped',
        ]);
    }
}
