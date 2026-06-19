<?php

require __DIR__.'/../vendor/autoload.php';

$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$chat = app(App\Services\WorkspaceMapleCaseChatService::class);

$context = [
    'case_facts' => [
        'main_applicant' => [
            'display_name' => 'Udul Uthsara Sulasetti Mudiyanselage',
            'name_source' => 'questionnaire',
        ],
    ],
    'case_file' => [
        'status' => 'AGREEMENT_SIGNED',
        'immigration_pathway' => 'Study Permit',
    ],
    'case_detail' => [
        'crs_estimate' => ['crs_total' => 360, 'rules_version' => '2025-03-25'],
        'questionnaire' => [
            'main_data' => [
                'studiedInCanada' => 'yes',
                'canadaStudyInstitution' => 'Seneca College',
                'canadianWork' => 'yes',
                'workExperience' => '1_to_2',
            ],
            'step1_data' => ['visaType' => 'Study'],
        ],
    ],
    'next_action' => ['title' => 'Review client questionnaire'],
    'immigration_knowledge' => [
        'express_entry_draws' => [
            ['draw_name' => 'General', 'minimum_crs_score' => 524, 'draw_date' => '2025-05-01'],
        ],
    ],
];

$history = [];

foreach ([
    'who is the main aplicane ?',
    'tel me best pathway to him',
    'is it good for him ?',
] as $q) {
    echo "Q: {$q}\n";
    $reply = $chat->reply($context, $q, $history);
    echo $reply."\n---\n";
    $history[] = ['role' => 'user', 'content' => $q];
    $history[] = ['role' => 'assistant', 'content' => $reply];
}
