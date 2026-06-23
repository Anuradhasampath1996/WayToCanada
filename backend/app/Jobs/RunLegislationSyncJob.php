<?php

namespace App\Jobs;

use App\Models\LegislationSyncRun;
use App\Services\LegislationLinkCoverageService;
use App\Services\LegislationReferenceAiService;
use App\Services\LegislationSyncService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class RunLegislationSyncJob implements ShouldQueue
{
    use Queueable;

    public int $timeout = 7200;

    public int $tries = 1;

    public function __construct(
        public int $syncRunId,
        public ?string $sourceSlug = null,
        public bool $runLinkify = false,
        public bool $runAiAnalysis = false,
    ) {}

    public function handle(
        LegislationSyncService $sync,
        LegislationReferenceAiService $ai,
        LegislationLinkCoverageService $coverage,
    ): void {
        $run = LegislationSyncRun::findOrFail($this->syncRunId);

        try {
            if ($run->scope === 'immigration_tier') {
                $stats = $sync->runImmigrationTierSync($run);
            } else {
                $stats = $sync->runSync($run, $this->sourceSlug);
            }

            $run->refresh();
            $mergedStats = array_merge($run->stats ?? [], is_array($stats) ? $stats : []);

            if ($this->runLinkify || $run->scope === 'sync_and_linkify') {
                $run->update(['current_step' => 'Re-linkifying cross-references…']);
                $mergedStats['linkify'] = $coverage->relinkifyAllXml();
            }

            if ($this->runAiAnalysis) {
                $run->update(['current_step' => 'AI analyze & linkify…']);
                $mergedStats['ai'] = $coverage->runAiLinkifyAll($ai, $run);
            }

            if ($this->runLinkify || $this->runAiAnalysis || $run->scope === 'sync_and_linkify') {
                $mergedStats['coverage'] = $coverage->aggregateCoverage();
                $run->update([
                    'stats'        => $mergedStats,
                    'current_step' => sprintf(
                        'Complete — link coverage %.1f%%',
                        $mergedStats['coverage']['coverage_percent'] ?? 0,
                    ),
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('Legislation sync job failed', ['error' => $e->getMessage()]);
            $run->update([
                'status'        => 'failed',
                'finished_at'   => now(),
                'error_message' => $e->getMessage(),
                'current_step'  => 'Failed',
            ]);
            throw $e;
        }
    }
}
