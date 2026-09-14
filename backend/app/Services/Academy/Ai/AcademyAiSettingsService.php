<?php

namespace App\Services\Academy\Ai;

use App\Models\Academy\AcademyAiSettings;
use App\Services\Academy\Ai\Exceptions\AcademyAiBudgetExceeded;

class AcademyAiSettingsService
{
    public function current(): array
    {
        $row = null;
        try {
            $row = AcademyAiSettings::query()->first();
        } catch (\Throwable) {
            $row = null;
        }
        $limits = config('academy_ai.limits');

        return [
            'enabled' => (bool) config('academy_ai.enabled'),
            'research_driver' => config('academy_ai.research_driver'),
            'generation_driver' => config('academy_ai.generation_driver'),
            'openai_configured' => filled(config('academy_ai.openai.key')) && ! str_starts_with((string) config('academy_ai.openai.key'), 'sk-test'),
            'manus_enabled' => (bool) config('academy_ai.manus.enabled') && ($row?->manus_enabled_override ?? true),
            'manus_configured' => (bool) config('academy_ai.manus.enabled') && filled(config('academy_ai.manus.api_key')),
            'reasoning_model' => config('academy_ai.openai.reasoning_model'),
            'fast_model' => config('academy_ai.openai.fast_model'),
            'validation_model' => config('academy_ai.openai.validation_model'),
            'image_model' => config('academy_ai.openai.image_model'),
            'monthly_budget_usd' => $row?->monthly_budget_usd ?? $limits['monthly_budget_usd'],
            'max_questions_per_job' => $row?->max_questions_per_job ?? $limits['max_questions_per_job'],
            'max_source_chars' => $row?->max_source_chars ?? $limits['max_source_chars'],
            'batch_size' => $row?->batch_size ?? $limits['batch_size'],
            'image_limit_per_job' => $row?->image_limit_per_job ?? $limits['image_limit_per_job'],
            'budget_warn_percent' => $row?->budget_warn_percent ?? $limits['budget_warn_percent'],
            'month_spend_usd' => app(AcademyAiUsageService::class)->monthSpendUsd(),
        ];
    }

    /** @param array<string, mixed> $data */
    public function update(array $data): array
    {
        $row = AcademyAiSettings::query()->first() ?: new AcademyAiSettings;
        $row->fill($data);
        $row->save();

        return $this->current();
    }

    public function maxQuestions(): int
    {
        return (int) $this->current()['max_questions_per_job'];
    }

    public function batchSize(): int
    {
        return (int) $this->current()['batch_size'];
    }

    public function assertBudget(): void
    {
        $settings = $this->current();
        $budget = (float) $settings['monthly_budget_usd'];
        if ($budget <= 0) {
            return;
        }
        if ((float) $settings['month_spend_usd'] >= $budget) {
            throw new AcademyAiBudgetExceeded('Monthly Academy AI budget has been reached.');
        }
    }

    public function estimateUsd(int $questionCount, bool $images): float
    {
        $per = (float) config('academy_ai.limits.estimate_usd_per_1k_tokens', 0.005);
        $tokens = max(1, $questionCount) * 800;

        return round(($tokens / 1000) * $per + ($images ? 0.16 : 0), 4);
    }
}
