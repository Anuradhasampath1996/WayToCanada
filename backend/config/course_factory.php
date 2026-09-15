<?php

return [
    'enabled' => filter_var(env('COURSE_FACTORY_ENABLED', true), FILTER_VALIDATE_BOOL),

    'openai' => [
        'key' => env('OPENAI_API_KEY'),
        'base_url' => rtrim(env('OPENAI_API_BASE_URL', 'https://api.openai.com/v1'), '/'),
        'text_model' => env('OPENAI_TEXT_MODEL', 'gpt-4o-mini'),
        'reasoning_model' => env('OPENAI_REASONING_MODEL', 'gpt-4o'),
        'image_model' => env('OPENAI_IMAGE_MODEL', 'gpt-image-1'),
        'timeout' => (int) env('OPENAI_TIMEOUT_SECONDS', 180),
    ],

    'manus' => [
        'api_key' => env('MANUS_API_KEY'),
        'base_url' => rtrim(env('MANUS_API_BASE_URL', 'https://api.manus.ai'), '/'),
        'agent_profile' => env('MANUS_AGENT_PROFILE', 'standard'),
        'poll_seconds' => (int) env('MANUS_POLL_SECONDS', 8),
        'timeout_seconds' => (int) env('MANUS_TIMEOUT_SECONDS', 900),
        'webhook_url' => env('MANUS_WEBHOOK_URL'),
        'webhook_replay_seconds' => 300,
    ],

    'question_bank' => [
        'multiplier' => (float) env('AI_COURSE_QUESTION_BANK_MULTIPLIER', 5),
        'min_size' => (int) env('AI_COURSE_MIN_QUESTION_BANK_SIZE', 500),
        'max_size' => (int) env('AI_COURSE_MAX_QUESTION_BANK_SIZE', 2000),
        'batch_size' => (int) env('AI_COURSE_QUESTION_BATCH_SIZE', 20),
    ],

    'difficulty_distribution' => [
        'easy' => (float) env('AI_COURSE_DIFFICULTY_EASY', 0.20),
        'medium' => (float) env('AI_COURSE_DIFFICULTY_MEDIUM', 0.50),
        'hard' => (float) env('AI_COURSE_DIFFICULTY_HARD', 0.30),
    ],

    'max_retries' => (int) env('AI_COURSE_MAX_RETRIES', 3),
    'manus_factual_sample_percent' => (float) env('AI_COURSE_MANUS_FACTUAL_SAMPLE_PERCENT', 8),
    'lesson_batch_size' => (int) env('AI_COURSE_LESSON_BATCH_SIZE', 3),
];
