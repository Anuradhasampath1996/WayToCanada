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

        try {
            $sync->runSync($run);
        } catch (\Throwable $e) {
            Log::error('RCIC register sync job failed', [
                'run_id' => $this->syncRunId,
                'error'  => $e->getMessage(),
            ]);

            $run->refresh();
            if (! in_array($run->status, ['completed', 'failed'], true)) {
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
}
