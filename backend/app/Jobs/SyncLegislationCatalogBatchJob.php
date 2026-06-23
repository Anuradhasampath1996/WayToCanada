<?php

namespace App\Jobs;

use App\Models\LegislationSyncRun;
use App\Services\LegislationSyncService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class SyncLegislationCatalogBatchJob implements ShouldQueue
{
    use Queueable;

    public int $timeout = 1800;

    public int $tries = 1;

    public function __construct(
        public int $syncRunId,
        public ?string $category = null,
        public ?int $batchSize = null,
        public bool $onlyUnsynced = true,
    ) {}

    public function handle(LegislationSyncService $sync): void
    {
        $batchSize = $this->batchSize ?? (int) config('legislation_sources.batch.default_size', 10);
        $batchSize = min($batchSize, (int) config('legislation_sources.batch.max_size', 30));

        $run = LegislationSyncRun::findOrFail($this->syncRunId);

        if ($sync->isRunHalted($run)) {
            return;
        }

        if ($run->status === 'pending') {
            $run->update(['status' => 'running', 'started_at' => now()]);
        }

        $entries = $sync->nextCatalogBatch($this->category, $batchSize, $this->onlyUnsynced);

        if ($entries === []) {
            if (! $sync->isRunHalted($run->fresh())) {
                $run->update([
                    'status'          => 'completed',
                    'finished_at'     => now(),
                    'completed_steps' => $run->total_steps,
                    'current_step'    => 'Catalog download complete — 100%',
                ]);
            }

            return;
        }

        try {
            $sync->runCatalogBatch($run, $entries);
            $run->refresh();

            if ($sync->isRunHalted($run)) {
                return;
            }

            self::dispatch($this->syncRunId, $this->category, $batchSize, $this->onlyUnsynced);
        } catch (\Throwable $e) {
            Log::error('Legislation catalog batch failed', ['error' => $e->getMessage()]);
            $run->update([
                'status'        => 'failed',
                'finished_at'   => now(),
                'error_message' => $e->getMessage(),
                'current_step'  => 'Batch failed',
            ]);
            throw $e;
        }
    }
}
