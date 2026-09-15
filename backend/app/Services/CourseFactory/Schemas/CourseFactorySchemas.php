<?php

namespace App\Services\CourseFactory\Schemas;

final class CourseFactorySchemas
{
    public static function examDiscovery(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'canonical_exam_name' => ['type' => 'string'],
                'acronym' => ['type' => ['string', 'null']],
                'regulator' => ['type' => ['string', 'null']],
                'jurisdiction' => ['type' => ['string', 'null']],
                'target_profession' => ['type' => ['string', 'null']],
                'target_candidate' => ['type' => ['string', 'null']],
                'licence_outcome' => ['type' => ['string', 'null']],
                'exam_status' => ['type' => ['string', 'null']],
                'official_exam_urls' => ['type' => 'array', 'items' => ['type' => 'string']],
                'candidate_guide_url' => ['type' => ['string', 'null']],
                'blueprint_url' => ['type' => ['string', 'null']],
                'notes' => ['type' => 'string'],
                'unknown_fields' => ['type' => 'array', 'items' => ['type' => 'string']],
            ],
            'required' => [
                'canonical_exam_name', 'acronym', 'regulator', 'jurisdiction', 'target_profession',
                'target_candidate', 'licence_outcome', 'exam_status', 'official_exam_urls',
                'candidate_guide_url', 'blueprint_url', 'notes', 'unknown_fields',
            ],
            'additionalProperties' => false,
        ];
    }

    public static function manusResearch(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'exam_name' => ['type' => 'string'],
                'regulator' => ['type' => ['string', 'null']],
                'candidate_handbook_url' => ['type' => ['string', 'null']],
                'eligibility_summary' => ['type' => 'string'],
                'exam_objectives' => ['type' => 'array', 'items' => ['type' => 'string']],
                'question_count' => ['type' => ['integer', 'null']],
                'duration_minutes' => ['type' => ['integer', 'null']],
                'delivery_format' => ['type' => ['string', 'null']],
                'open_book' => ['type' => ['boolean', 'null']],
                'question_types' => ['type' => 'array', 'items' => ['type' => 'string']],
                'domains' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'name' => ['type' => 'string'],
                            'weight_percent' => ['type' => ['number', 'null']],
                            'competencies' => ['type' => 'array', 'items' => ['type' => 'string']],
                        ],
                        'required' => ['name', 'weight_percent', 'competencies'],
                        'additionalProperties' => false,
                    ],
                ],
                'legislation' => ['type' => 'array', 'items' => ['type' => 'string']],
                'regulations' => ['type' => 'array', 'items' => ['type' => 'string']],
                'ethics_standards' => ['type' => 'array', 'items' => ['type' => 'string']],
                'preparation_resources' => ['type' => 'array', 'items' => ['type' => 'string']],
                'knowledge_cutoff_notes' => ['type' => ['string', 'null']],
                'sources' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'title' => ['type' => 'string'],
                            'url' => ['type' => 'string'],
                            'organization' => ['type' => 'string'],
                            'source_type' => ['type' => 'string'],
                            'authority_tier' => ['type' => 'integer'],
                            'publication_date' => ['type' => ['string', 'null']],
                            'notes' => ['type' => 'string'],
                            'topics' => ['type' => 'array', 'items' => ['type' => 'string']],
                        ],
                        'required' => ['title', 'url', 'organization', 'source_type', 'authority_tier', 'publication_date', 'notes', 'topics'],
                        'additionalProperties' => false,
                    ],
                ],
                'unknown_fields' => ['type' => 'array', 'items' => ['type' => 'string']],
                'research_summary' => ['type' => 'string'],
            ],
            'required' => [
                'exam_name', 'regulator', 'candidate_handbook_url', 'eligibility_summary', 'exam_objectives',
                'question_count', 'duration_minutes', 'delivery_format', 'open_book', 'question_types',
                'domains', 'legislation', 'regulations', 'ethics_standards', 'preparation_resources',
                'knowledge_cutoff_notes', 'sources', 'unknown_fields', 'research_summary',
            ],
            'additionalProperties' => false,
        ];
    }

    public static function verification(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'is_sufficient' => ['type' => 'boolean'],
                'contradictions' => ['type' => 'array', 'items' => ['type' => 'string']],
                'missing_critical' => ['type' => 'array', 'items' => ['type' => 'string']],
                'unsupported_claims' => ['type' => 'array', 'items' => ['type' => 'string']],
                'outdated_flags' => ['type' => 'array', 'items' => ['type' => 'string']],
                'follow_up_research_prompt' => ['type' => ['string', 'null']],
                'confidence' => ['type' => 'string'],
                'notes' => ['type' => 'string'],
            ],
            'required' => [
                'is_sufficient', 'contradictions', 'missing_critical', 'unsupported_claims',
                'outdated_flags', 'follow_up_research_prompt', 'confidence', 'notes',
            ],
            'additionalProperties' => false,
        ];
    }

    public static function blueprint(): array
    {
        return self::manusResearch(); // same shape normalized into blueprint storage
    }

    public static function courseMetadata(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'title' => ['type' => 'string'],
                'short_title' => ['type' => 'string'],
                'slug' => ['type' => 'string'],
                'subtitle' => ['type' => 'string'],
                'short_description' => ['type' => 'string'],
                'full_description' => ['type' => 'string'],
                'target_audience' => ['type' => 'string'],
                'prerequisites' => ['type' => 'array', 'items' => ['type' => 'string']],
                'expected_outcomes' => ['type' => 'array', 'items' => ['type' => 'string']],
                'learning_objectives' => ['type' => 'array', 'items' => ['type' => 'string']],
                'estimated_hours' => ['type' => 'number'],
                'difficulty' => ['type' => 'string'],
                'tags' => ['type' => 'array', 'items' => ['type' => 'string']],
                'seo_title' => ['type' => 'string'],
                'seo_description' => ['type' => 'string'],
            ],
            'required' => [
                'title', 'short_title', 'slug', 'subtitle', 'short_description', 'full_description',
                'target_audience', 'prerequisites', 'expected_outcomes', 'learning_objectives',
                'estimated_hours', 'difficulty', 'tags', 'seo_title', 'seo_description',
            ],
            'additionalProperties' => false,
        ];
    }

    public static function architecture(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'modules' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'title' => ['type' => 'string'],
                            'description' => ['type' => 'string'],
                            'objectives' => ['type' => 'array', 'items' => ['type' => 'string']],
                            'mapped_competencies' => ['type' => 'array', 'items' => ['type' => 'string']],
                            'study_minutes' => ['type' => 'integer'],
                            'lessons' => [
                                'type' => 'array',
                                'items' => [
                                    'type' => 'object',
                                    'properties' => [
                                        'title' => ['type' => 'string'],
                                        'objectives' => ['type' => 'array', 'items' => ['type' => 'string']],
                                        'outline' => ['type' => 'string'],
                                    ],
                                    'required' => ['title', 'objectives', 'outline'],
                                    'additionalProperties' => false,
                                ],
                            ],
                        ],
                        'required' => ['title', 'description', 'objectives', 'mapped_competencies', 'study_minutes', 'lessons'],
                        'additionalProperties' => false,
                    ],
                ],
                'coverage_matrix' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'domain' => ['type' => 'string'],
                            'module_titles' => ['type' => 'array', 'items' => ['type' => 'string']],
                        ],
                        'required' => ['domain', 'module_titles'],
                        'additionalProperties' => false,
                    ],
                ],
            ],
            'required' => ['modules', 'coverage_matrix'],
            'additionalProperties' => false,
        ];
    }

    public static function lesson(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'html_content' => ['type' => 'string'],
                'objectives' => ['type' => 'array', 'items' => ['type' => 'string']],
                'references' => ['type' => 'array', 'items' => ['type' => 'string']],
                'glossary' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'term' => ['type' => 'string'],
                            'definition' => ['type' => 'string'],
                        ],
                        'required' => ['term', 'definition'],
                        'additionalProperties' => false,
                    ],
                ],
                'exam_tips' => ['type' => 'array', 'items' => ['type' => 'string']],
                'common_mistakes' => ['type' => 'array', 'items' => ['type' => 'string']],
                'needs_diagram' => ['type' => 'boolean'],
                'diagram_prompt' => ['type' => ['string', 'null']],
            ],
            'required' => [
                'html_content', 'objectives', 'references', 'glossary', 'exam_tips',
                'common_mistakes', 'needs_diagram', 'diagram_prompt',
            ],
            'additionalProperties' => false,
        ];
    }

    public static function questionsBatch(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'questions' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'stem' => ['type' => 'string'],
                            'options' => ['type' => 'array', 'items' => ['type' => 'string']],
                            'correct_index' => ['type' => 'integer'],
                            'explanation' => ['type' => 'string'],
                            'distractor_explanations' => ['type' => 'array', 'items' => ['type' => 'string']],
                            'competency' => ['type' => 'string'],
                            'domain' => ['type' => 'string'],
                            'topic' => ['type' => 'string'],
                            'subtopic' => ['type' => 'string'],
                            'difficulty' => ['type' => 'string'],
                            'question_type' => ['type' => 'string'],
                            'source_references' => ['type' => 'array', 'items' => ['type' => 'string']],
                        ],
                        'required' => [
                            'stem', 'options', 'correct_index', 'explanation', 'distractor_explanations',
                            'competency', 'domain', 'topic', 'subtopic', 'difficulty', 'question_type', 'source_references',
                        ],
                        'additionalProperties' => false,
                    ],
                ],
            ],
            'required' => ['questions'],
            'additionalProperties' => false,
        ];
    }

    public static function questionValidation(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'accepted' => ['type' => 'boolean'],
                'issues' => ['type' => 'array', 'items' => ['type' => 'string']],
                'corrected_correct_index' => ['type' => ['integer', 'null']],
                'notes' => ['type' => 'string'],
            ],
            'required' => ['accepted', 'issues', 'corrected_correct_index', 'notes'],
            'additionalProperties' => false,
        ];
    }

    public static function coverageAudit(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'passed' => ['type' => 'boolean'],
                'score' => ['type' => 'number'],
                'blocking_gaps' => ['type' => 'array', 'items' => ['type' => 'string']],
                'warnings' => ['type' => 'array', 'items' => ['type' => 'string']],
                'domain_coverage' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'domain' => ['type' => 'string'],
                            'official_weight' => ['type' => ['number', 'null']],
                            'bank_coverage' => ['type' => 'number'],
                            'status' => ['type' => 'string'],
                        ],
                        'required' => ['domain', 'official_weight', 'bank_coverage', 'status'],
                        'additionalProperties' => false,
                    ],
                ],
            ],
            'required' => ['passed', 'score', 'blocking_gaps', 'warnings', 'domain_coverage'],
            'additionalProperties' => false,
        ];
    }

    public static function assignmentBatch(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'assignments' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'module_title' => ['type' => 'string'],
                            'title' => ['type' => 'string'],
                            'objective' => ['type' => 'string'],
                            'instructions' => ['type' => 'string'],
                            'expected_outcome' => ['type' => 'string'],
                            'estimated_minutes' => ['type' => 'integer'],
                            'competency' => ['type' => 'string'],
                            'evaluation_guidance' => ['type' => 'string'],
                        ],
                        'required' => [
                            'module_title', 'title', 'objective', 'instructions', 'expected_outcome',
                            'estimated_minutes', 'competency', 'evaluation_guidance',
                        ],
                        'additionalProperties' => false,
                    ],
                ],
            ],
            'required' => ['assignments'],
            'additionalProperties' => false,
        ];
    }

    public static function caseBatch(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'cases' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'title' => ['type' => 'string'],
                            'profile' => ['type' => 'string'],
                            'timeline' => ['type' => 'array', 'items' => ['type' => 'string']],
                            'facts' => ['type' => 'array', 'items' => ['type' => 'string']],
                            'legal_issues' => ['type' => 'array', 'items' => ['type' => 'string']],
                            'ethical_issues' => ['type' => 'array', 'items' => ['type' => 'string']],
                            'linked_question_topics' => ['type' => 'array', 'items' => ['type' => 'string']],
                        ],
                        'required' => [
                            'title', 'profile', 'timeline', 'facts', 'legal_issues', 'ethical_issues', 'linked_question_topics',
                        ],
                        'additionalProperties' => false,
                    ],
                ],
            ],
            'required' => ['cases'],
            'additionalProperties' => false,
        ];
    }
}
