<?php

return [

    'letter_types' => [
        'approval_support'    => 'Approval / support letter',
        'refusal_response'    => 'Refusal response draft',
        'document_request'    => 'Client document request',
        'submission_cover'    => 'Submission cover letter',
        'explanation'         => 'Explanation / representation letter',
        'follow_up'           => 'Follow-up / status inquiry',
        'other'               => 'Other (custom)',
    ],

    'openai' => [
        'enabled' => env('CONSULTANT_LETTERS_OPENAI_ENABLED', true),
        'model'   => env('CONSULTANT_LETTERS_OPENAI_MODEL', env('WORKSPACE_AI_MODEL', 'gpt-4o-mini')),
        'timeout' => (int) env('CONSULTANT_LETTERS_OPENAI_TIMEOUT', 90),
    ],

];
