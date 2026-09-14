<?php

namespace App\Services\Academy\Ai;

class AcademyAiSchemas
{
    /** @return array<string, mixed> */
    public static function named(string $name): array
    {
        return match ($name) {
            'research_notes' => self::researchNotes(),
            'course_blueprint' => self::courseBlueprint(),
            'lesson' => self::lesson(),
            'independent_mcq' => self::independentMcq(),
            'case_scenario' => self::caseScenario(),
            'case_mcq' => self::caseMcq(),
            'citation_map' => self::citationMap(),
            'question_validator' => self::questionValidator(),
            'ambiguity_check' => self::ambiguityCheck(),
            'image_prompt' => self::imagePrompt(),
            default => throw new \InvalidArgumentException('Unknown Academy AI schema: '.$name),
        };
    }

    /** @return array<string, mixed> */
    public static function researchNotes(): array
    {
        return self::object([
            'notes' => ['type' => 'string'],
            'candidate_sources' => [
                'type' => 'array',
                'items' => self::object([
                    'title' => ['type' => 'string'],
                    'url' => ['type' => 'string'],
                    'organization' => ['type' => 'string'],
                    'excerpt' => ['type' => 'string'],
                    'why_relevant' => ['type' => 'string'],
                ]),
            ],
            'changed_material_flags' => [
                'type' => 'array',
                'items' => self::object([
                    'url' => ['type' => 'string'],
                    'note' => ['type' => 'string'],
                ]),
            ],
            'secondary_only' => ['type' => 'boolean'],
        ]);
    }

    /** @return array<string, mixed> */
    public static function courseBlueprint(): array
    {
        return self::object([
            'title' => ['type' => 'string'],
            'goal' => ['type' => 'string'],
            'track_key' => ['type' => 'string'],
            'modules' => [
                'type' => 'array',
                'items' => self::object([
                    'title' => ['type' => 'string'],
                    'objective' => ['type' => 'string'],
                    'estimated_hours' => ['type' => 'number'],
                    'topic_keys' => ['type' => 'array', 'items' => ['type' => 'string']],
                    'lesson_outlines' => [
                        'type' => 'array',
                        'items' => self::object([
                            'title' => ['type' => 'string'],
                            'objective' => ['type' => 'string'],
                        ]),
                    ],
                ]),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    public static function lesson(): array
    {
        return self::object([
            'title' => ['type' => 'string'],
            'objectives' => ['type' => 'array', 'items' => ['type' => 'string']],
            'overview' => ['type' => 'string'],
            'key_concepts' => ['type' => 'array', 'items' => ['type' => 'string']],
            'relevant_law' => ['type' => 'array', 'items' => ['type' => 'string']],
            'practical_interpretation' => ['type' => 'string'],
            'exam_notes' => ['type' => 'string'],
            'common_mistakes' => ['type' => 'array', 'items' => ['type' => 'string']],
            'worked_example' => ['type' => 'string'],
            'takeaways' => ['type' => 'array', 'items' => ['type' => 'string']],
            'source_refs' => ['type' => 'array', 'items' => ['type' => 'string']],
            'practice_question_stubs' => ['type' => 'array', 'items' => ['type' => 'string']],
        ]);
    }

    /** @return array<string, mixed> */
    public static function independentMcq(): array
    {
        return self::object([
            'stem' => ['type' => 'string'],
            'options' => [
                'type' => 'array',
                'items' => self::object([
                    'key' => ['type' => 'string'],
                    'text' => ['type' => 'string'],
                    'is_correct' => ['type' => 'boolean'],
                    'incorrect_explanation' => ['type' => 'string'],
                ]),
            ],
            'explanation' => ['type' => 'string'],
            'difficulty' => ['type' => 'string'],
            'topic_keys' => ['type' => 'array', 'items' => ['type' => 'string']],
            'competency_keys' => ['type' => 'array', 'items' => ['type' => 'string']],
            'citations' => [
                'type' => 'array',
                'items' => self::object([
                    'label' => ['type' => 'string'],
                    'section' => ['type' => 'string'],
                    'excerpt' => ['type' => 'string'],
                    'snapshot_hint' => ['type' => 'string'],
                ]),
            ],
            'source_evidence' => ['type' => 'array', 'items' => ['type' => 'string']],
            'confidence_notes' => ['type' => 'string'],
        ]);
    }

    /** @return array<string, mixed> */
    public static function caseScenario(): array
    {
        return self::object([
            'title' => ['type' => 'string'],
            'facts' => ['type' => 'string'],
            'immigration_history' => ['type' => 'string'],
            'procedural_history' => ['type' => 'string'],
            'evidence' => ['type' => 'string'],
            'tribunal_context' => ['type' => 'string'],
            'legal_issues' => ['type' => 'array', 'items' => ['type' => 'string']],
            'exhibits' => [
                'type' => 'array',
                'items' => self::object([
                    'title' => ['type' => 'string'],
                    'exhibit_type' => ['type' => 'string'],
                    'body' => ['type' => 'string'],
                ]),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    public static function caseMcq(): array
    {
        $schema = self::independentMcq();
        $schema['properties']['case_anchor'] = ['type' => 'string'];
        $schema['required'][] = 'case_anchor';

        return $schema;
    }

    /** @return array<string, mixed> */
    public static function citationMap(): array
    {
        return self::object([
            'claims' => [
                'type' => 'array',
                'items' => self::object([
                    'claim' => ['type' => 'string'],
                    'section_label' => ['type' => 'string'],
                    'excerpt' => ['type' => 'string'],
                    'verified' => ['type' => 'boolean'],
                    'snapshot_hint' => ['type' => 'string'],
                ]),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    public static function questionValidator(): array
    {
        return self::object([
            'chosen_option_key' => ['type' => 'string'],
            'reasoning' => ['type' => 'string'],
            'evidence' => ['type' => 'string'],
            'ambiguous' => ['type' => 'boolean'],
            'supported_by_sources' => ['type' => 'boolean'],
        ]);
    }

    /** @return array<string, mixed> */
    public static function ambiguityCheck(): array
    {
        return self::object([
            'ambiguous' => ['type' => 'boolean'],
            'reason' => ['type' => 'string'],
            'possible_keys' => ['type' => 'array', 'items' => ['type' => 'string']],
        ]);
    }

    /** @return array<string, mixed> */
    public static function imagePrompt(): array
    {
        return self::object([
            'prompt' => ['type' => 'string'],
            'kind' => ['type' => 'string'],
        ]);
    }

    /**
     * @param  array<string, array<string, mixed>>  $properties
     * @return array<string, mixed>
     */
    private static function object(array $properties): array
    {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'properties' => $properties,
            'required' => array_keys($properties),
        ];
    }
}
