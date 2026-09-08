<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$consultant = App\Models\User::factory()->create([
    'name' => 'E2E RCIC',
    'rcic_number' => 'R999999999',
    'company_name' => 'E2E Firm',
]);
$consultant->assignRole('rcic');

$client = App\Models\User::factory()->create(['name' => 'E2E Synthetic Client']);
$client->assignRole('client');

$profile = App\Models\ClientProfile::create([
    'user_id' => $client->id,
    'consultant_id' => $consultant->id,
]);

$case = App\Models\CaseFile::create([
    'client_profile_id' => $profile->id,
    'consultant_id' => $consultant->id,
    'case_number' => 9001,
    'name' => 'E2E Government Form Case',
    'status' => 'active',
    'lifecycle_status' => 'in_progress',
]);

$profile->update(['active_case_file_id' => $case->id]);

App\Models\QuestionnaireSubmission::create([
    'user_id' => $client->id,
    'main_data' => ['passportFullName' => 'Synthetic Client'],
    'step1_data' => ['email' => $client->email],
    'is_submitted' => true,
    'submitted_at' => now(),
]);

echo "profile_id={$profile->id}\n";
