<?php

namespace App\Services\Academy\Ai;

use App\Models\Academy\AcademyAiGeneratedItem;
use App\Models\Academy\AcademyAiGenerationJob;
use App\Models\Academy\AcademyAiSourceSnapshot;
use App\Models\Academy\AcademyAiValidationResult;
use App\Models\Academy\AcademyLegalSource;
use App\Models\Academy\AcademyQuestionVersion;

class AcademyAiValidationService
{
    /** @var list<string> */
    public array $lastValidatorUserParts = [];

    public function __construct(
        private AcademyAiProviderFactory $factory,
        private AcademyAiUsageService $usage,
    ) {}

    public function validateItem(AcademyAiGenerationJob $job, AcademyAiGeneratedItem $item): AcademyAiValidationResult
    {
        $payload = $item->payload_json ?? [];
        $flags = [];
        $structural = $this->structuralOk($item->item_type, $payload);
        if (! $structural) {
            $flags[] = 'structural_invalid';
        }

        $generatedKey = $this->generatedCorrectKey($payload);
        $citations = $payload['citations'] ?? [];
        $grounding = $this->groundingOk($job, $citations, $flags);
        $currency = $this->currencyOk($job, $flags);

        $validatorKey = null;
        $agrees = null;
        $ambiguous = false;
        $validatorModel = null;
        $validatorPayload = null;

        if (in_array($item->item_type, ['independent_mcq', 'case_mcq'], true) && $structural) {
            $user = $this->independentSolvePrompt($job, $payload);
            $this->lastValidatorUserParts = [$user];
            $result = $this->factory->generation()->validateStructured(
                AcademyAiSchemas::questionValidator(),
                'question_validator',
                AcademyAiPromptCatalog::system('question_validator'),
                $user,
                ['model_role' => 'validation'],
            );
            $this->usage->recordStructured($job->id, 'validate', $result, AcademyAiPromptCatalog::version('question_validator'));
            $validatorPayload = $result->data;
            $validatorKey = (string) ($result->data['chosen_option_key'] ?? '');
            $validatorModel = $result->model;
            $agrees = $generatedKey !== '' && strcasecmp($validatorKey, $generatedKey) === 0;
            if (! $agrees) {
                $flags[] = 'answer_conflict';
                $flags[] = 'needs_review';
            }
            $ambiguous = (bool) ($result->data['ambiguous'] ?? false);
            if (! $ambiguous) {
                $amb = $this->factory->generation()->generateStructured(
                    AcademyAiSchemas::ambiguityCheck(),
                    'ambiguity_check',
                    AcademyAiPromptCatalog::system('ambiguity_check'),
                    $user,
                    ['model_role' => 'validation'],
                );
                $ambiguous = (bool) ($amb->data['ambiguous'] ?? false);
            }
            if ($ambiguous) {
                $flags[] = 'ambiguous';
                $flags[] = 'needs_review';
            }
        }

        $this->applyExamPasses($job, $payload, $flags);
        $label = $this->label($flags, $grounding, $agrees);
        $item->update([
            'citation_unverified' => in_array('citation_unverified', $flags, true),
            'admin_label' => $label,
        ]);

        return AcademyAiValidationResult::query()->updateOrCreate(
            ['generated_item_id' => $item->id],
            [
                'structural_ok' => $structural,
                'grounding_ok' => $grounding,
                'agrees_with_generated' => $agrees,
                'ambiguous' => $ambiguous,
                'currency_ok' => $currency,
                'validator_option_key' => $validatorKey,
                'generated_option_key' => $generatedKey,
                'source_grounding_score' => $grounding ? 90 : 20,
                'answer_consistency_score' => $agrees === null ? null : ($agrees ? 95 : 15),
                'ambiguity_score' => $ambiguous ? 80 : 10,
                'citation_coverage_score' => $grounding ? 85 : 10,
                'admin_label' => $label,
                'flags_json' => array_values(array_unique($flags)),
                'validator_payload_json' => $validatorPayload,
                'validator_model' => $validatorModel,
                'exam_relevance_ok' => ! in_array('low_exam_relevance', $flags, true),
                'style_ok' => ! in_array('style_mismatch', $flags, true),
                'near_copy_ok' => ! in_array('near_past_paper', $flags, true),
            ]
        );
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<string>  $flags
     */
    public function applyExamPasses(AcademyAiGenerationJob $job, array $payload, array &$flags): void
    {
        if (! $job->exam_id) {
            return;
        }
        $exam = \App\Models\Academy\AcademyExam::query()->find($job->exam_id);
        if ($exam) {
            $allowed = collect($exam->exam_format_json['competencies'] ?? [])->filter()->all();
            $questionComps = collect($payload['competencies'] ?? [])->filter()->all();
            if ($allowed !== [] && $questionComps !== [] && array_intersect($questionComps, $allowed) === []) {
                $flags[] = 'low_exam_relevance';
                $flags[] = 'needs_review';
            }
        }
        $pack = $job->evidence_pack_id
            ? \App\Models\Academy\AcademyExamEvidencePack::query()->find($job->evidence_pack_id)
            : null;
        $expectedStyle = $pack?->pattern_metadata_json['dominant_style'] ?? null;
        if ($expectedStyle && isset($payload['style_pattern_category']) && $payload['style_pattern_category'] !== $expectedStyle) {
            $flags[] = 'style_mismatch';
            $flags[] = 'needs_review';
        }
        $stem = (string) ($payload['stem'] ?? '');
        if ($pack && $stem !== '') {
            foreach ($pack->items as $item) {
                $official = (string) ($item->excerpt ?? '');
                if ($official !== '' && app(\App\Services\Learning\ExamEvidencePackService::class)->nearCopy($stem, $official)) {
                    $flags[] = 'near_past_paper';
                    $flags[] = 'needs_review';
                    break;
                }
            }
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function independentSolvePrompt(AcademyAiGenerationJob $job, array $payload): string
    {
        $options = collect($payload['options'] ?? [])->map(function ($option) {
            return ($option['key'] ?? '').'. '.($option['text'] ?? '');
        })->implode("\n");

        $sources = $job->snapshots()->where('authoritative', true)->get()
            ->map(fn (AcademyAiSourceSnapshot $s) => AcademyAiPromptCatalog::wrapUntrusted($s->title ?: 'source', (string) $s->excerpt))
            ->implode("\n\n");

        return "Question:\n".($payload['stem'] ?? '')."\n\nOptions:\n".$options."\n\n".$sources."\n\nChoose the best option key. Do not assume any option is already marked correct.";
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function structuralOk(string $type, array $payload): bool
    {
        if (in_array($type, ['independent_mcq', 'case_mcq'], true)) {
            $options = $payload['options'] ?? [];
            if (! is_array($options) || count($options) < 2) {
                return false;
            }
            $correct = collect($options)->where('is_correct', true);
            if ($correct->count() !== 1) {
                return false;
            }
            $texts = collect($options)->pluck('text')->map(fn ($t) => mb_strtolower(trim((string) $t)));
            if ($texts->count() !== $texts->unique()->count()) {
                return false;
            }
            if (trim((string) ($payload['stem'] ?? '')) === '') {
                return false;
            }
        }

        return $payload !== [];
    }

    /**
     * @param  list<array<string, mixed>>  $citations
     * @param  list<string>  $flags
     */
    public function groundingOk(AcademyAiGenerationJob $job, array $citations, array &$flags): bool
    {
        if ($citations === []) {
            $flags[] = 'citation_unverified';

            return false;
        }

        $excerpts = $job->snapshots->pluck('excerpt')->implode(' ')." ".$job->snapshots->pluck('title')->implode(' ');
        $ok = true;
        foreach ($citations as $cite) {
            $hint = mb_strtolower((string) ($cite['snapshot_hint'] ?? $cite['label'] ?? ''));
            $excerpt = mb_strtolower((string) ($cite['excerpt'] ?? ''));
            $hay = mb_strtolower($excerpts);
            if ($hint === '' || $hint === 'none' || ! str_contains($hay, mb_substr($hint, 0, 8))) {
                if ($excerpt === '' || ! str_contains($hay, mb_substr($excerpt, 0, 12))) {
                    $ok = false;
                    $flags[] = 'citation_unverified';
                }
            }
        }

        return $ok;
    }

    /** @param list<string> $flags */
    public function currencyOk(AcademyAiGenerationJob $job, array &$flags): bool
    {
        foreach ($job->snapshots as $snapshot) {
            if ($snapshot->legal_source_id) {
                $source = AcademyLegalSource::query()->find($snapshot->legal_source_id);
                if ($source && $source->status === 'outdated') {
                    $flags[] = 'source_currency';

                    return false;
                }
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function generatedCorrectKey(array $payload): string
    {
        foreach ($payload['options'] ?? [] as $option) {
            if (! empty($option['is_correct'])) {
                return (string) ($option['key'] ?? '');
            }
        }

        return '';
    }

    /** @param list<string> $flags */
    private function label(array $flags, bool $grounding, ?bool $agrees): string
    {
        if (in_array('answer_conflict', $flags, true)) {
            return 'Review Required';
        }
        if (in_array('citation_unverified', $flags, true) || ! $grounding) {
            return 'Citation Unverified';
        }
        if (in_array('low_exam_relevance', $flags, true)) {
            return 'Review Required';
        }
        if (in_array('style_mismatch', $flags, true)) {
            return 'Review Required';
        }
        if (in_array('needs_review', $flags, true) || in_array('ambiguous', $flags, true)) {
            return 'Review Required';
        }

        return $agrees === false ? 'Review Required' : 'Verified';
    }

    public function applyQuestionFlags(AcademyQuestionVersion $version, AcademyAiValidationResult $result): void
    {
        $flags = $result->flags_json ?? [];
        if (array_intersect(['citation_unverified', 'answer_conflict', 'ambiguous', 'source_currency'], $flags)) {
            $version->update(['needs_legal_review' => true]);
        }
    }
}
