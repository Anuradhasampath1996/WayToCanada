<?php

require __DIR__.'/../vendor/autoload.php';

$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$chat = app(App\Services\WorkspaceMapleCaseChatService::class);

$context = [
    'case_facts' => [
        'married' => true,
        'main_applicant' => [
            'display_name' => 'Udul Uthsara Sulasetti Mudiyanselage',
            'name_source' => 'questionnaire',
            'passport_full_name' => 'Udul Uthsara Sulasetti Mudiyanselage',
        ],
        'spouse' => ['display_name' => 'sadhali', 'full_name' => 'sadhali'],
    ],
    'case_detail' => [
        'questionnaire' => [
            'step1_data' => ['dependentChildren' => '2', 'married' => 'yes'],
            'main_data' => ['fullName' => 'Udul Uthsara Sulasetti Mudiyanselage', 'dob' => '1999-01-27'],
            'spouse_data' => ['fullName' => 'sadhali'],
            'children_data' => [
                ['fullName' => 'Child One'],
                ['fullName' => 'Child Two'],
            ],
        ],
    ],
    'case_file' => ['status' => 'AGREEMENT_SIGNED'],
    'next_action' => ['title' => 'Review'],
    'questionnaire' => ['has_submission' => true],
];

$history = [
    ['role' => 'user', 'content' => 'what is the name of main aplicant ?'],
    ['role' => 'assistant', 'content' => 'The main applicant is Udul Uthsara Sulasetti Mudiyanselage (from questionnaire main applicant profile).'],
];

$tests = [
    'have man child have him ?',
    'lamai kiyak innavada udul uthsara ta ?',
    'what is the spuse name ?',
    'what details have we about sadhali?',
];

foreach ($tests as $q) {
    echo "Q: {$q}\n";
    echo $chat->reply($context, $q, $history)."\n---\n";
}
