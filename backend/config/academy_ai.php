<?php

return [
    'enabled' => filter_var(env('ACADEMY_AI_ENABLED', true), FILTER_VALIDATE_BOOL),

    /*
     * Test drivers: set to "fake" in PHPUnit. Production: "auto".
     * auto research = Manus when enabled+configured, else OpenAI.
     * auto generation = OpenAI Responses API.
     */
    'research_driver' => env('ACADEMY_AI_RESEARCH_DRIVER', 'auto'),
    'generation_driver' => env('ACADEMY_AI_GENERATION_DRIVER', 'auto'),

    'openai' => [
        'key' => env('ACADEMY_OPENAI_API_KEY', env('OPENAI_API_KEY')),
        'base_url' => env('ACADEMY_OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        'reasoning_model' => env('ACADEMY_AI_REASONING_MODEL', 'gpt-4o-2024-08-06'),
        'fast_model' => env('ACADEMY_AI_FAST_MODEL', 'gpt-4o-mini-2024-07-18'),
        'validation_model' => env('ACADEMY_AI_VALIDATION_MODEL', env('ACADEMY_AI_REASONING_MODEL', 'gpt-4o-2024-08-06')),
        'image_model' => env('ACADEMY_AI_IMAGE_MODEL', 'gpt-image-1'),
        'timeout' => (int) env('ACADEMY_AI_TIMEOUT_SECONDS', 120),
    ],

    'manus' => [
        'enabled' => filter_var(env('ACADEMY_MANUS_ENABLED', false), FILTER_VALIDATE_BOOL),
        'api_key' => env('MANUS_API_KEY'),
        'base_url' => env('ACADEMY_MANUS_BASE_URL', 'https://api.manus.ai'),
        'agent_profile' => env('ACADEMY_MANUS_AGENT_PROFILE', 'standard'),
        'fallback' => env('ACADEMY_MANUS_FALLBACK', 'openai'), // openai | fail
        'poll_seconds' => (int) env('ACADEMY_MANUS_POLL_SECONDS', 5),
        'timeout_seconds' => (int) env('ACADEMY_MANUS_TIMEOUT_SECONDS', 180),
        'webhook_url' => env('ACADEMY_MANUS_WEBHOOK_URL'),
        'webhook_replay_seconds' => 300,
    ],

    'limits' => [
        'max_questions_per_job' => (int) env('ACADEMY_AI_MAX_QUESTIONS_PER_JOB', 600),
        'max_source_chars' => (int) env('ACADEMY_AI_MAX_SOURCE_CHARS', 80000),
        'batch_size' => (int) env('ACADEMY_AI_BATCH_SIZE', 10),
        'monthly_budget_usd' => (float) env('ACADEMY_AI_MONTHLY_BUDGET_USD', 250),
        'budget_warn_percent' => (int) env('ACADEMY_AI_BUDGET_WARN_PERCENT', 80),
        'image_limit_per_job' => (int) env('ACADEMY_AI_IMAGE_LIMIT_PER_JOB', 8),
        'estimate_usd_per_1k_tokens' => (float) env('ACADEMY_AI_USD_PER_1K_TOKENS', 0.005),
    ],

    'retrieval_allow_hosts' => [
        'laws-lois.justice.gc.ca',
        'justice.gc.ca',
        'www.justice.gc.ca',
        'irb-cisr.gc.ca',
        'www.irb-cisr.gc.ca',
        'canada.ca',
        'www.canada.ca',
        'college-ic.ca',
        'www.college-ic.ca',
    ],

    'forbidden_image_terms' => [
        'seal', 'coat of arms', 'official form', 'IMM ', 'credential',
        'exam screenshot', 'CICC logo', 'IRCC logo', 'IRB endorsement',
    ],
];
