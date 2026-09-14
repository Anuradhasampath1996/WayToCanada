<?php

namespace App\Services\Academy\Ai\Providers;

use App\Services\Academy\Ai\Contracts\AcademyGenerationProvider;
use App\Services\Academy\Ai\Dto\ImageGenerationResult;
use App\Services\Academy\Ai\Dto\StructuredGeneration;
use App\Services\Academy\Ai\Exceptions\AcademyAiException;

class FakeAcademyGenerationProvider implements AcademyGenerationProvider
{
    public ?array $lastValidateUser = null;

    public ?array $lastGenerate = null;

    public ?string $forceInvalidJson = null;

    public ?string $validatorKey = 'A';

    public bool $validatorAmbiguous = false;

    public bool $failImages = false;

    public int $generateCalls = 0;

    public function configured(): bool
    {
        return true;
    }

    public function name(): string
    {
        return 'fake';
    }

    public function generateStructured(array $schema, string $schemaName, string $system, string $user, array $context = []): StructuredGeneration
    {
        $this->generateCalls++;
        $this->lastGenerate = compact('schemaName', 'system', 'user', 'context');

        if ($this->forceInvalidJson === $schemaName) {
            $this->forceInvalidJson = null;
            throw new AcademyAiException('Invalid model JSON.');
        }

        return new StructuredGeneration(
            data: $this->payload($schemaName, $user, $context),
            provider: 'fake',
            model: 'fake-model',
            usage: ['input_tokens' => 10, 'output_tokens' => 20],
            requestId: 'fake-req',
        );
    }

    public function validateStructured(array $schema, string $schemaName, string $system, string $user, array $context = []): StructuredGeneration
    {
        $this->lastValidateUser = ['system' => $system, 'user' => $user, 'context' => $context];

        return new StructuredGeneration(
            data: [
                'chosen_option_key' => $this->validatorKey,
                'reasoning' => 'Solved from stem, options, and snapshots only.',
                'evidence' => 'Snapshot excerpt.',
                'ambiguous' => $this->validatorAmbiguous,
                'supported_by_sources' => ! $this->validatorAmbiguous,
            ],
            provider: 'fake',
            model: 'fake-validator',
            usage: ['input_tokens' => 5, 'output_tokens' => 5],
        );
    }

    public function generateImage(string $prompt, array $options = []): ImageGenerationResult
    {
        if ($this->failImages) {
            throw new AcademyAiException('Image generation failed.');
        }

        return new ImageGenerationResult(
            binary: 'fake-png-bytes',
            provider: 'fake',
            model: 'fake-image',
            prompt: $prompt,
            estimatedCostUsd: 0.04,
        );
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function payload(string $schemaName, string $user, array $context): array
    {
        $index = (int) ($context['index'] ?? 0);

        return match ($schemaName) {
            'research_notes' => [
                'notes' => 'Official Canadian sources only.',
                'candidate_sources' => [[
                    'title' => 'IRPA',
                    'url' => 'https://laws-lois.justice.gc.ca/eng/acts/I-2.5/',
                    'organization' => 'Department of Justice',
                    'excerpt' => 'IRPA',
                    'why_relevant' => 'statute',
                ]],
                'changed_material_flags' => [],
                'secondary_only' => true,
            ],
            'course_blueprint' => [
                'title' => 'RCIC-IRB Specialization Exam Mastery',
                'goal' => 'Prepare RCICs for IRB specialization study.',
                'track_key' => 'irb_specialization',
                'modules' => [[
                    'title' => 'IRB Foundations',
                    'objective' => 'Understand IRB structure.',
                    'estimated_hours' => 2,
                    'topic_keys' => ['irb_foundations'],
                    'lesson_outlines' => [
                        ['title' => 'IRB Overview', 'objective' => 'Name the four divisions.'],
                    ],
                ]],
            ],
            'lesson' => [
                'title' => 'IRB Overview',
                'objectives' => ['Identify IRB divisions'],
                'overview' => 'The IRB has four divisions.',
                'key_concepts' => ['ID', 'IAD', 'RPD', 'RAD'],
                'relevant_law' => ['IRPA'],
                'practical_interpretation' => 'Map facts to the correct division.',
                'exam_notes' => 'Division identification is frequently tested.',
                'common_mistakes' => ['Confusing IAD and ID'],
                'worked_example' => 'A removal order appeal belongs at IAD.',
                'takeaways' => ['Know the four divisions'],
                'source_refs' => ['IRPA'],
                'practice_question_stubs' => ['Which division hears removal-order appeals?'],
            ],
            'independent_mcq', 'case_mcq' => $this->mcq($schemaName, $index, $user, $context),
            'case_scenario' => [
                'title' => 'Mixed IRB case '.$index,
                'facts' => 'A claimant seeks protection after arriving in Canada.',
                'immigration_history' => 'Entered as a visitor.',
                'procedural_history' => 'Claim referred to RPD.',
                'evidence' => 'Country-condition package.',
                'tribunal_context' => 'RPD',
                'legal_issues' => ['Nexus', 'Credibility'],
                'exhibits' => [[
                    'title' => 'BOC',
                    'exhibit_type' => 'boc',
                    'body' => 'Basis of claim narrative.',
                ]],
            ],
            'citation_map' => [
                'claims' => [[
                    'claim' => 'Refugee protection is set out in IRPA.',
                    'section_label' => 's. 96',
                    'excerpt' => 'A person who is a Convention refugee.',
                    'verified' => ! str_contains($user, 'UNVERIFIABLE_CITATION'),
                    'snapshot_hint' => 'IRPA',
                ]],
            ],
            'ambiguity_check' => [
                'ambiguous' => str_contains($user, 'AMBIGUOUS_FLAG') || ! empty($context['force_ambiguous']),
                'reason' => 'Checked options.',
                'possible_keys' => ! empty($context['force_ambiguous']) ? ['A', 'B'] : ['A'],
            ],
            'image_prompt' => [
                'prompt' => 'Neutral study diagram of four labelled boxes representing tribunal divisions, no seals.',
                'kind' => 'lesson',
            ],
            default => ['ok' => true],
        };
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function mcq(string $schemaName, int $index, string $user, array $context): array
    {
        $difficulty = (string) ($context['difficulty'] ?? 'medium');
        $topic = (string) ($context['topic_key'] ?? 'irb_foundations');
        $stem = ($context['stem'] ?? null) ?: (($schemaName === 'case_mcq' ? 'On these facts, which division has jurisdiction? (' : 'Which IRB division typically hears refugee protection claims? (').$index.')');
        if (str_contains($user, 'DUPLICATE_STEM:')) {
            $stem = trim((string) preg_replace('/.*DUPLICATE_STEM:(.+)$/s', '$1', $user));
        }

        $data = [
            'stem' => $stem,
            'options' => [
                ['key' => 'A', 'text' => 'Refugee Protection Division', 'is_correct' => true, 'incorrect_explanation' => ''],
                ['key' => 'B', 'text' => 'Immigration Appeal Division', 'is_correct' => false, 'incorrect_explanation' => 'IAD hears many appeals, not first-instance refugee claims.'],
                ['key' => 'C', 'text' => 'Federal Court trial division', 'is_correct' => false, 'incorrect_explanation' => 'Not an IRB division.'],
                ['key' => 'D', 'text' => 'All of the above', 'is_correct' => false, 'incorrect_explanation' => 'Not permitted.'],
            ],
            'explanation' => 'RPD determines most inland refugee protection claims.',
            'difficulty' => $difficulty,
            'topic_keys' => [$topic],
            'competency_keys' => ['legal_research'],
            'citations' => [[
                'label' => str_contains($user, 'UNVERIFIABLE_CITATION') ? 'Made-up Regulation 999' : 'IRPA',
                'section' => str_contains($user, 'UNVERIFIABLE_CITATION') ? 's. 999' : 's. 96',
                'excerpt' => str_contains($user, 'UNVERIFIABLE_CITATION') ? 'no snapshot support' : 'Convention refugee',
                'snapshot_hint' => str_contains($user, 'UNVERIFIABLE_CITATION') ? 'none' : 'IRPA',
            ]],
            'source_evidence' => ['IRPA refugee protection'],
            'confidence_notes' => 'internal only',
        ];

        if ($schemaName === 'case_mcq') {
            $data['case_anchor'] = 'case-'.$index;
        }

        return $data;
    }
}
