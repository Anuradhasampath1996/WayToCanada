<?php

namespace App\Services\Academy\Ai;

use App\Models\Academy\AcademyAiUsageRecord;
use App\Services\Academy\Ai\Dto\StructuredGeneration;

class AcademyAiUsageService
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
        ?float $actualCost = null,
        bool $costEstimated = true,
        ?string $requestId = null,
        ?string $taskId = null,
        array $extra = [],
        ?int $stepId = null,
    ): AcademyAiUsageRecord {
        if ($estimatedCost === null && ($inputTokens || $outputTokens)) {
            $tokens = (int) $inputTokens + (int) $outputTokens;
            $estimatedCost = round(($tokens / 1000) * (float) config('academy_ai.limits.estimate_usd_per_1k_tokens', 0.005), 4);
            $costEstimated = true;
        }

        if ($provider === 'manus' && $actualCost === null) {
            $costEstimated = true;
        }

        return AcademyAiUsageRecord::query()->create([
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
            'actual_cost_usd' => $actualCost,
            'cost_is_estimated' => $costEstimated,
            'meta_json' => $extra ?: null,
        ]);
    }

    public function recordStructured(?int $jobId, string $operation, StructuredGeneration $result, ?string $promptVersion = null, ?int $stepId = null): AcademyAiUsageRecord
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

    public function monthSpendUsd(): float
    {
        try {
            return (float) AcademyAiUsageRecord::query()
                ->where('created_at', '>=', now()->startOfMonth())
                ->selectRaw('COALESCE(SUM(COALESCE(actual_cost_usd, estimated_cost_usd)),0) as spend')
                ->value('spend');
        } catch (\Throwable) {
            return 0.0;
        }
    }
}
