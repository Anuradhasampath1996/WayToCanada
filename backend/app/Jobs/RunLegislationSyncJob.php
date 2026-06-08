<?php

namespace App\Jobs;

use App\Models\LegislationSyncRun;
use App\Services\LegislationReferenceAiService;
use App\Services\LegislationSyncService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class RunLegislationSyncJob implements ShouldQueue
{
    use Queueable;

    public int $timeout = 3600;

    public function __construct(
        public int $syncRunId,
        public ?string $sourceSlug = null,
        public bool $runAiAnalysis = false,
    ) {}

    public function handle(LegislationSyncService $sync, LegislationReferenceAiService $ai): void
    {
        $run = LegislationSyncRun::findOrFail($this->syncRunId);

        try {
            $sync->runSync($run, $this->sourceSlug);

            if ($this->runAiAnalysis) {
                $run->update(['current_step' => 'AI reference analysis']);
                foreach (\App\Models\LegislationDocument::where('format', 'xml')->where('ai_analyzed', false)->cursor() as $doc) {
                    $ai->analyzeDocument($doc);
                }
            }
        } catch (\Throwable $e) {
            Log::error('Legislation sync job failed', ['error' => $e->getMessage()]);
            throw $e;
        }
    }
}
