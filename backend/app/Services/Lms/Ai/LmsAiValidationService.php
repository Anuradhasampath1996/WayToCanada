<?php

namespace App\Services\Lms\Ai;

use App\Models\Lms\LmsAiGeneratedItem;
use App\Models\Lms\LmsAiGenerationJob;
use App\Models\Lms\LmsAiSourceSnapshot;
use App\Models\Lms\LmsAiValidationResult;
use App\Models\Lms\LmsExam;
use App\Models\Lms\LmsExamEvidencePack;
use App\Models\Lms\LmsExamQuestionVersion;
use App\Services\Academy\Ai\AcademyAiProviderFactory;
use App\Services\Academy\Ai\AcademyAiSchemas;
use App\Services\Learning\ExamEvidencePackService;

class LmsAiValidationService
{
    public function __construct(
        private AcademyAiProviderFactory $factory,
        private LmsAiUsageService $usage,
    ) {}

    public function validateItem(LmsAiGenerationJob $job, LmsAiGeneratedItem $item): LmsAiValidationResult
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

        $validatorKey = null;
        $agrees = null;
        $ambiguous = false;
        $validatorModel = null;
        $validatorPayload = null;
        $profile = (string) $job->generation_profile;

        if (in_array($item->item_type, ['independent_mcq', 'topic_quiz'], true) && $structural) {
            $user = $this->independentSolvePrompt($job, $payload);
            $result = $this->factory->generation()->validateStructured(
                AcademyAiSchemas::questionValidator(),
                'question_validator',
                LmsAiPromptCatalog::system('question_validator', $profile),
                $user,
                ['model_role' => 'validation', 'generation_profile' => $profile],
            );
            $this->usage->recordStructured($job->id, 'validate', $result, LmsAiPromptCatalog::version('question_validator', $profile));
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
                    LmsAiPromptCatalog::system('ambiguity_check', $profile),
                    $user,
                    ['model_role' => 'validation', 'generation_profile' => $profile],
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

        return LmsAiValidationResult::query()->updateOrCreate(
            ['generated_item_id' => $item->id],
            [
                'structural_ok' => $structural,
                'grounding_ok' => $grounding,
                'agrees_with_generated' => $agrees,
                'ambiguous' => $ambiguous,
                'flags_json' => array_values(array_unique($flags)),
                'validator_payload_json' => $validatorPayload,
                'validator_model' => $validatorModel,
            ]
        );
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<string>  $flags
     */
    public function applyExamPasses(LmsAiGenerationJob $job, array $payload, array &$flags): void
    {
        if (! $job->exam_id) {
            return;
        }
        $exam = LmsExam::query()->find($job->exam_id);
        if ($exam) {
            $allowed = collect($exam->exam_format_json['competencies'] ?? $exam->exam_format_json['topics'] ?? [])->filter()->all();
            $questionComps = collect($payload['competencies'] ?? $payload['topic_keys'] ?? [])->filter()->all();
            if ($allowed !== [] && $questionComps !== [] && array_intersect($questionComps, $allowed) === []) {
                $flags[] = 'low_exam_relevance';
                $flags[] = 'needs_review';
            }
        }
        $pack = $job->evidence_pack_id
            ? LmsExamEvidencePack::query()->with('items')->find($job->evidence_pack_id)
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
                if ($official !== '' && app(ExamEvidencePackService::class)->nearCopy($stem, $official)) {
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
    public function independentSolvePrompt(LmsAiGenerationJob $job, array $payload): string
    {
        $options = collect($payload['options'] ?? [])->map(function ($option) {
            return ($option['key'] ?? '').'. '.($option['text'] ?? '');
        })->implode("\n");

        $sources = $job->snapshots()->where('authoritative', true)->get()
            ->map(fn (LmsAiSourceSnapshot $s) => LmsAiPromptCatalog::wrapUntrusted($s->title ?: 'source', (string) $s->excerpt))
            ->implode("\n\n");

        return "Question:\n".($payload['stem'] ?? '')."\n\nOptions:\n".$options."\n\n".$sources."\n\nChoose the best option key. Do not assume any option is already marked correct.";
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function structuralOk(string $type, array $payload): bool
    {
        if (in_array($type, ['independent_mcq', 'topic_quiz'], true)) {
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
    public function groundingOk(LmsAiGenerationJob $job, array $citations, array &$flags): bool
    {
        if ($citations === []) {
            $flags[] = 'citation_unverified';

            return false;
        }

        $excerpts = $job->snapshots()->where('authoritative', true)->get()->pluck('excerpt')->implode(' ')
            .' '.$job->snapshots()->where('authoritative', true)->get()->pluck('title')->implode(' ');
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
        if (in_array('answer_conflict', $flags, true) || in_array('needs_review', $flags, true) || in_array('ambiguous', $flags, true)) {
            return 'Review Required';
        }
        if (in_array('citation_unverified', $flags, true) || ! $grounding) {
            return 'Citation Unverified';
        }

        return $agrees === false ? 'Review Required' : 'Verified';
    }

    public function applyQuestionFlags(LmsExamQuestionVersion $version, LmsAiValidationResult $result): void
    {
        $version->update([
            'validation_flags_json' => $result->flags_json ?? [],
        ]);
    }
}
