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

    public function __construct(
        public int $syncRunId,
        public ?string $category = null,
        public int $batchSize = 5,
        public bool $onlyUnsynced = true,
    ) {}

    public function handle(LegislationSyncService $sync): void
    {
        $run = LegislationSyncRun::findOrFail($this->syncRunId);

        if ($run->status === 'pending') {
            $run->update(['status' => 'running', 'started_at' => now()]);
        }

        $entries = $sync->nextCatalogBatch($this->category, $this->batchSize, $this->onlyUnsynced);

        if ($entries === []) {
            $run->update([
                'status'       => 'completed',
                'finished_at'  => now(),
                'current_step' => 'Catalog batch sync complete',
            ]);

            return;
        }

        try {
            $batchStats = $sync->runCatalogBatch($run, $entries);
            $existing   = $run->stats ?? [];
            $run->update([
                'stats' => [
                    'created'        => ($existing['created'] ?? 0) + $batchStats['created'],
                    'updated'        => ($existing['updated'] ?? 0) + $batchStats['updated'],
                    'errors'         => array_merge($existing['errors'] ?? [], $batchStats['errors']),
                    'synced_entries' => ($existing['synced_entries'] ?? 0) + $batchStats['synced_entries'],
                    'category'       => $this->category,
                ],
            ]);

            self::dispatch($this->syncRunId, $this->category, $this->batchSize, $this->onlyUnsynced);
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
