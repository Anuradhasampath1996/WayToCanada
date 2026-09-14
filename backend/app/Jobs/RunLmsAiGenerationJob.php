<?php

namespace App\Jobs;

use App\Services\Lms\Ai\LmsAiJobService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RunLmsAiGenerationJob implements ShouldQueue
{
    use Queueable;

    public int $timeout = 7200;

    public int $tries = 1;

    public function __construct(public int $generationJobId) {}

    public function handle(LmsAiJobService $jobs): void
    {
        try {
            $jobs->process($this->generationJobId);
        } catch (\App\Services\Academy\Ai\Exceptions\AcademyAiException) {
            // Job row already marked failed/partially_failed.
        }
    }
}
