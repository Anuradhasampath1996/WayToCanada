<?php

require __DIR__.'/../vendor/autoload.php';

$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$chat = app(App\Services\WorkspaceMapleCaseChatService::class);
$context = [
    'case_facts' => [
        'account' => ['name' => 'anuradha sampath', 'email' => 'test@example.com'],
        'main_applicant' => ['display_name' => 'anuradha sampath', 'name_source' => 'client portal account'],
        'married' => false,
    ],
    'case_file' => ['status' => 'PENDING_ASSESSMENT', 'immigration_pathway' => null],
    'next_action' => ['title' => 'Waiting for client questionnaire', 'description' => 'Ask client to submit.'],
    'questionnaire' => ['has_submission' => false, 'is_submitted' => false],
    'questionnaire_gaps' => [['label' => 'Client has not started the questionnaire']],
];

echo $chat->reply($context, 'what is main aplivan name ?').PHP_EOL;
