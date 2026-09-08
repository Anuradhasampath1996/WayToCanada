<?php

/**
 * Stage H synthetic fixture — dev DB only (IMM 5406 family data).
 *
 * Usage: php scripts/stage-h-setup-fixture.php
 */

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\IrccPackageDocumentSubmission;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Database\Seeders\GovernmentFormVersionSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\Hash;

const STAGE_H_CONSULTANT_EMAIL = 'stageh.consultant@rcicmaster.test';
const STAGE_H_CONSULTANT_PASSWORD = 'StageHTest123!';
const STAGE_H_CLIENT_EMAIL = 'stageh.client@rcicmaster.test';

$seeder = new RolesAndPermissionsSeeder;
$seeder->run();
(new GovernmentFormVersionSeeder)->run();

$consultant = User::updateOrCreate(
    ['email' => STAGE_H_CONSULTANT_EMAIL],
    [
        'name' => 'Consultant Stage H RCIC',
        'password' => Hash::make(STAGE_H_CONSULTANT_PASSWORD),
        'rcic_number' => 'R999999998',
        'company_name' => 'RCICMASTER Stage H',
        'email_verified_at' => now(),
        'is_verified' => true,
    ],
);
if (! $consultant->hasRole('rcic')) {
    $consultant->assignRole('rcic');
}

$client = User::updateOrCreate(
    ['email' => STAGE_H_CLIENT_EMAIL],
    [
        'name' => 'Synthetic STAGEHTEST',
        'password' => Hash::make('StageHClient123!'),
        'email_verified_at' => now(),
    ],
);
if (! $client->hasRole('client')) {
    $client->assignRole('client');
}

$profile = ClientProfile::firstOrCreate(
    ['user_id' => $client->id, 'consultant_id' => $consultant->id],
);

$case = CaseFile::updateOrCreate(
    ['client_profile_id' => $profile->id, 'consultant_id' => $consultant->id],
    [
        'case_number' => 5406,
        'name' => 'Stage H IMM5406 Verification Case',
        'status' => 'active',
        'lifecycle_status' => 'in_progress',
        'application_info_reviewed_at' => null,
        'application_info_reviewed_by' => null,
        'questionnaire_snapshot' => null,
        'questionnaire_snapshot_hash' => null,
        'questionnaire_snapshot_at' => null,
    ],
);

$profile->update(['active_case_file_id' => $case->id]);

IrccPackageDocumentSubmission::where('case_file_id', $case->id)
    ->whereNotNull('government_form_version_id')
    ->each(function ($sub) {
        if ($sub->file_path && \Illuminate\Support\Facades\Storage::disk($sub->storage_disk ?: 'local')->exists($sub->file_path)) {
            \Illuminate\Support\Facades\Storage::disk($sub->storage_disk ?: 'local')->delete($sub->file_path);
        }
        $sub->delete();
    });

QuestionnaireSubmission::updateOrCreate(
    ['user_id' => $client->id],
    [
        'main_data' => [
            'passportFullName' => 'Synthetic STAGEHTEST',
            'dob' => '1990-03-20',
            'birthCountry' => 'Sri Lanka',
            'addressLine1' => '123 Stage H Street',
            'city' => 'Toronto',
            'countryOfResidence' => 'Canada',
        ],
        'step1_data' => [
            'email' => STAGE_H_CLIENT_EMAIL,
            'married' => 'no',
        ],
        'spouse_data' => [],
        'children_data' => [[
            'fullName' => 'Child One STAGEH',
            'dob' => '2015-01-01',
            'relationship' => 'Child',
        ]],
        'accompanying_data' => [
            ['fullName' => 'Parent One STAGEH', 'dob' => '1960-02-02', 'relationship' => 'my_parent', 'nicBirthPlace' => 'Sri Lanka', 'nicAddress' => 'Colombo, Sri Lanka'],
            ['fullName' => 'Parent Two STAGEH', 'dob' => '1962-04-04', 'relationship' => 'my_parent', 'nicBirthPlace' => 'Sri Lanka', 'nicAddress' => 'Kandy, Sri Lanka'],
        ],
        'is_submitted' => true,
        'submitted_at' => now(),
    ],
);

echo json_encode([
    'consultant_email' => STAGE_H_CONSULTANT_EMAIL,
    'consultant_password' => STAGE_H_CONSULTANT_PASSWORD,
    'client_email' => STAGE_H_CLIENT_EMAIL,
    'profile_id' => $profile->id,
    'case_file_id' => $case->id,
    'consultant_id' => $consultant->id,
    'synthetic' => [
        'applicant' => 'Synthetic STAGEHTEST',
        'child' => 'Child One STAGEH',
        'parent1' => 'Parent One STAGEH',
        'parent2' => 'Parent Two STAGEH',
    ],
    'case_hub_url' => "http://localhost:3005/dashboard/clients/{$profile->id}/workspace/case-management",
], JSON_PRETTY_PRINT).PHP_EOL;
