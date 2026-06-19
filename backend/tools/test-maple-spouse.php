<?php

require __DIR__.'/../vendor/autoload.php';

$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$chat = app(App\Services\WorkspaceMapleCaseChatService::class);

$spouseData = [
    'fullName' => 'sadhali',
    'dob' => '1992-05-10',
    'passportNumber' => 'N1234567',
    'passportNationality' => 'Sri Lanka',
    'educationLevels' => ['bachelors'],
    'languageTest' => 'yes',
    'languageTestType' => 'ielts',
    'scores' => ['listening' => 7.5, 'reading' => 7.0, 'writing' => 6.5, 'speaking' => 7.0],
];

$context = [
    'case_facts' => [
        'married' => true,
        'main_applicant' => ['display_name' => 'Udul Uthsara', 'name_source' => 'questionnaire'],
        'spouse' => ['display_name' => 'sadhali', 'full_name' => 'sadhali'],
        'account' => ['name' => 'Udul Uthsara'],
    ],
    'case_file' => ['status' => 'AGREEMENT_SIGNED', 'immigration_pathway' => 'Study Permit'],
    'case_detail' => [
        'questionnaire' => [
            'main_data' => ['fullName' => 'Udul Uthsara'],
            'spouse_data' => $spouseData,
        ],
        'crs_estimate' => ['crs_total' => 360],
    ],
    'next_action' => ['title' => 'Review client questionnaire'],
    'questionnaire' => ['has_submission' => true, 'is_submitted' => true],
    'immigration_knowledge' => [],
];

$history = [
    ['role' => 'user', 'content' => 'what is the spouse name ?'],
    ['role' => 'assistant', 'content' => 'The spouse on file is sadhali.'],
];

$spouseSparse = [
    'fullName' => 'sadhali',
    'languageTest' => 'yes',
    'languageTestType' => 'ielts',
    'scores' => ['listening' => '', 'reading' => '', 'writing' => '', 'speaking' => ''],
    'frenchTestType' => 'tef',
    'frenchScores' => ['listening' => '', 'reading' => '', 'writing' => '', 'speaking' => ''],
    'canadianWork' => 'yes',
];

echo "=== Sparse (user-like) ===\n";
$ctx2 = $context;
$ctx2['case_detail']['questionnaire']['spouse_data'] = $spouseSparse;
echo $chat->reply($ctx2, 'what details have we about sadhali?', $history).PHP_EOL;
echo "---\n";
echo $chat->reply($context, 'what details have we about sadhali?', $history).PHP_EOL;
echo '---'.PHP_EOL;
echo $chat->reply($context, 'sadhali ge details kiyanna', $history).PHP_EOL;
echo '---'.PHP_EOL;
echo $chat->reply($context, 'what details do we have?', $history).PHP_EOL;
