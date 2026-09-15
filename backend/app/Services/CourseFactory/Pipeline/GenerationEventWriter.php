<?php

namespace App\Services\CourseFactory\Pipeline;

use App\Models\CourseFactory\CfGenerationEvent;
use App\Models\CourseFactory\CfGenerationRun;
use App\Models\CourseFactory\CfUsageRecord;

class GenerationEventWriter
{
    public function write(
        CfGenerationRun $run,
        string $type,
        string $title,
        ?string $message = null,
        ?string $agent = null,
        array $payload = [],
        string $level = 'info',
    ): CfGenerationEvent {
        return CfGenerationEvent::query()->create([
            'generation_run_id' => $run->id,
            'event_type' => $type,
            'level' => $level,
            'title' => $title,
            'message' => $message,
            'agent' => $agent,
            'payload' => $payload ?: null,
        ]);
    }

    public function trackUsage(
        CfGenerationRun $run,
        string $provider,
        ?string $model = null,
        array $usage = [],
        ?int $stepId = null,
        int $images = 0,
        int $manusTasks = 0,
        ?int $durationMs = null,
    ): void {
        CfUsageRecord::query()->create([
            'generation_run_id' => $run->id,
            'generation_step_id' => $stepId,
            'provider' => $provider,
            'model' => $model,
            'request_count' => 1,
            'input_tokens' => (int) ($usage['prompt_tokens'] ?? $usage['input_tokens'] ?? 0),
            'output_tokens' => (int) ($usage['completion_tokens'] ?? $usage['output_tokens'] ?? 0),
            'image_generations' => $images,
            'manus_task_count' => $manusTasks,
            'duration_ms' => $durationMs,
            'meta' => $usage ?: null,
        ]);
    }
}
