<?php

return [
    'default_access_months' => 3,
    'currency' => 'CAD',
    'verification_intervals_days' => [
        'rcic_exam_prep' => (int) env('LEARNING_RCIC_EVIDENCE_DAYS', 90),
        'citizenship_exam_prep' => (int) env('LEARNING_CITIZENSHIP_EVIDENCE_DAYS', 90),
        'language_exam_prep' => (int) env('LEARNING_LANGUAGE_EVIDENCE_DAYS', 180),
    ],
    'official_hosts' => [
        'rcic_exam_prep' => [
            'college-ic.ca',
            'www.college-ic.ca',
            'irb-cisr.gc.ca',
            'www.irb-cisr.gc.ca',
            'laws-lois.justice.gc.ca',
            'www.laws-lois.justice.gc.ca',
            'justice.gc.ca',
            'www.justice.gc.ca',
            'canada.ca',
            'www.canada.ca',
        ],
        'citizenship_exam_prep' => [
            'canada.ca',
            'www.canada.ca',
            'ircc.canada.ca',
        ],
        'language_exam_prep' => [
            'ielts.org',
            'www.ielts.org',
            'ielts.idp.com',
            'www.ielts.idp.com',
            'paragontesting.ca',
            'www.paragontesting.ca',
            'pearsonpte.com',
            'www.pearsonpte.com',
            'lefrancaisdesaffaires.fr',
            'www.lefrancaisdesaffaires.fr',
            'france-education-international.fr',
            'www.france-education-international.fr',
            'canada.ca',
            'www.canada.ca',
        ],
    ],
    'generation_profiles' => [
        'rcic_exam_prep' => [
            'product_domain' => 'rcic_academy',
            'uses_cases' => true,
            'requires_cicc_legal_review' => true,
        ],
        'citizenship_exam_prep' => [
            'product_domain' => 'client_lms',
            'uses_cases' => false,
            'requires_cicc_legal_review' => false,
        ],
        'language_exam_prep' => [
            'product_domain' => 'client_lms',
            'uses_cases' => false,
            'requires_cicc_legal_review' => false,
        ],
    ],
];
