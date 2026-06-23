<?php

namespace App\Services;

use App\Jobs\SyncLegislationCatalogBatchJob;
use App\Models\LegislationSyncRun;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LegislationSyncControlService
{
    public function cancel(LegislationSyncRun $run): LegislationSyncRun
    {
        if (! in_array($run->status, ['pending', 'running', 'paused'], true)) {
            throw new \RuntimeException('This download is not active.');
        }

        $run->update([
            'status'        => 'cancelled',
            'finished_at'   => now(),
            'current_step'  => 'Cancelled by admin',
            'error_message' => null,
        ]);

        $this->clearQueuedJobs($run->id);

        return $run->fresh();
    }

    public function pause(LegislationSyncRun $run): LegislationSyncRun
    {
        if (! in_array($run->status, ['pending', 'running'], true)) {
            throw new \RuntimeException('Only a running download can be paused.');
        }

        $stats   = $run->stats ?? [];
        $synced  = (int) ($stats['synced_entries'] ?? $run->completed_steps);
        $pending = (int) ($stats['pending_total'] ?? $run->total_steps);

        $run->update([
            'status'       => 'paused',
            'current_step' => $pending > 0
                ? sprintf('Paused at %d / %d — click Resume to continue', $synced, $pending)
                : 'Paused — click Resume to continue',
        ]);

        $this->clearQueuedJobs($run->id);

        return $run->fresh();
    }

    public function resume(LegislationSyncRun $run): LegislationSyncRun
    {
        if ($run->status !== 'paused') {
            throw new \RuntimeException('This download is not paused.');
        }

        if ($run->scope !== 'catalog_batch' && $run->scope !== 'catalog') {
            throw new \RuntimeException('Resume is only supported for catalog batch downloads.');
        }

        $stats = $run->stats ?? [];
        $run->update([
            'status'       => 'running',
            'finished_at'  => null,
            'current_step' => 'Resuming download…',
        ]);

        SyncLegislationCatalogBatchJob::dispatch(
            $run->id,
            $stats['category'] ?? null,
            null,
            (bool) ($stats['only_unsynced'] ?? true),
        );

        return $run->fresh();
    }

    private function clearQueuedJobs(int $runId): void
    {
        $driver = (string) config('queue.default');
        if ($driver !== 'database' || ! Schema::hasTable('jobs')) {
            return;
        }

        $needle = '"syncRunId";i:'.$runId.';';

        DB::table('jobs')
            ->where('payload', 'like', '%'.$needle.'%')
            ->delete();
    }
}
