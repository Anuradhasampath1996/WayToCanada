<?php

namespace App\Services\Lms\Ai;

use App\Models\Lms\LmsAiUsageRecord;
use App\Services\Academy\Ai\Dto\StructuredGeneration;

class LmsAiUsageService
{
    /**
     * @param  array<string, mixed>  $extra
     */
    public function record(
        ?int $jobId,
        string $provider,
        string $operation,
        ?string $model = null,
        ?string $promptVersion = null,
        ?int $inputTokens = null,
        ?int $outputTokens = null,
        ?float $estimatedCost = null,
        array $extra = [],
        ?int $stepId = null,
        ?string $requestId = null,
        ?string $taskId = null,
    ): LmsAiUsageRecord {
        if ($estimatedCost === null && ($inputTokens || $outputTokens)) {
            $tokens = (int) $inputTokens + (int) $outputTokens;
            $estimatedCost = round(($tokens / 1000) * (float) config('academy_ai.limits.estimate_usd_per_1k_tokens', 0.005), 4);
        }

        return LmsAiUsageRecord::query()->create([
            'generation_job_id' => $jobId,
            'step_id' => $stepId,
            'provider' => $provider,
            'operation' => $operation,
            'model' => $model,
            'prompt_version' => $promptVersion,
            'provider_request_id' => $requestId,
            'provider_task_id' => $taskId,
            'input_tokens' => $inputTokens,
            'output_tokens' => $outputTokens,
            'estimated_cost_usd' => $estimatedCost,
            'cost_is_estimated' => true,
            'meta_json' => $extra ?: null,
        ]);
    }

    public function recordStructured(?int $jobId, string $operation, StructuredGeneration $result, ?string $promptVersion = null, ?int $stepId = null): LmsAiUsageRecord
    {
        $usage = $result->usage;

        return $this->record(
            jobId: $jobId,
            provider: $result->provider,
            operation: $operation,
            model: $result->model,
            promptVersion: $promptVersion,
            inputTokens: $usage['input_tokens'] ?? $usage['prompt_tokens'] ?? null,
            outputTokens: $usage['output_tokens'] ?? $usage['completion_tokens'] ?? null,
            requestId: $result->requestId,
            stepId: $stepId,
        );
    }
}
