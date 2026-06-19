<?php

/**
 * Curated Canadian immigration reference for Maple (offline + AI context).
 * Pair with live CRS rules, EE draws, and synced IRPA/IRPR provisions.
 */
return [
    'pathways' => [
        'express_entry' => 'Federal Express Entry manages FSW, CEC, and FST pools. Candidates need an eligible profile, CRS score, and an ITA before applying for PR. Draw cut-offs change by category (general, PNP, French, trade, healthcare, etc.).',
        'pnp' => 'Provincial Nominee Programs let provinces nominate candidates. A nomination typically adds 600 CRS points in Express Entry or supports a direct provincial stream. Each province has its own criteria and occupation lists.',
        'study_permit' => 'Study permits are temporary. Pathways to PR often include PGWP, Canadian work experience (CEC), or PNP after graduation. Genuine student intent and financial capacity matter.',
        'work_permit' => 'Employer-specific or LMIA-exempt work permits are temporary. PR pathways may include CEC, PNP, or employer-driven streams depending on NOC, experience, and province.',
        'family_sponsorship' => 'Canadian citizens and PRs may sponsor spouses, partners, dependent children, parents, and grandparents subject to income requirements, relationship proof, and admissibility.',
    ],
    'admissibility' => [
        'criminal' => 'Criminal convictions can render an applicant inadmissible. Assess offence type, equivalence, rehabilitation, and whether deemed rehabilitation or a TRP strategy applies. Always verify against IRPA inadmissibility provisions.',
        'medical' => 'Medical inadmissibility relates to excessive demand on health/social services or danger to public health/safety. MMI and specialist opinions may be required.',
        'misrepresentation' => 'Material misrepresentation can lead to a 5-year ban. Consistency across forms, questionnaire, and supporting documents is critical.',
        'visa_refusal' => 'Prior refusals require transparent disclosure and a strategy addressing the prior officer\'s concerns in new submissions.',
    ],
    'crs_notes' => [
        'Provincial nomination adds 600 CRS points (verify active rules version).',
        'Sibling in Canada (citizen or PR) can add 15 CRS points if eligible.',
        'French language bonus points depend on CLB levels and English scores — see active CRS rules.',
        'Canadian education and Canadian work experience can add significant CRS and FSW points.',
        'Job offer CRS bonus points were removed effective 2025-03-25; arranged employment may still matter for FSW selection factors.',
    ],
];
