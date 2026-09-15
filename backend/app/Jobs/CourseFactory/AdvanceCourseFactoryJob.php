<?php

namespace App\Jobs\CourseFactory;

use App\Models\CourseFactory\CfGenerationRun;
use App\Services\CourseFactory\Pipeline\CourseFactoryOrchestrator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class AdvanceCourseFactoryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** Question-bank batches can take several minutes of OpenAI time. */
    public int $timeout = 900;

    public function __construct(public int $runId) {}

    public function handle(CourseFactoryOrchestrator $orchestrator): void
    {
        try {
            app(\App\Services\IntegrationSettingsService::class)->applyRuntimeConfig();
        } catch (\Throwable) {
            // ignore
        }

        $run = CfGenerationRun::query()->find($this->runId);
        if (! $run || in_array($run->status, ['cancelled'], true)) {
            return;
        }

        $orchestrator->advance($this->runId);
    }
}
