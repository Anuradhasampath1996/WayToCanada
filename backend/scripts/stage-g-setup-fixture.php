<?php

/**
 * Stage G synthetic fixture — dev DB only.
 * Creates an isolated consultant + client with identifiable IMM 5476 data.
 *
 * Usage: php scripts/stage-g-setup-fixture.php
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

const STAGE_G_CONSULTANT_EMAIL = 'stageg.consultant@rcicmaster.test';
const STAGE_G_CONSULTANT_PASSWORD = 'StageGTest123!';
const STAGE_G_CLIENT_EMAIL = 'stageg.client@rcicmaster.test';

$seeder = new RolesAndPermissionsSeeder;
$seeder->run();
(new GovernmentFormVersionSeeder)->run();

$consultant = User::updateOrCreate(
    ['email' => STAGE_G_CONSULTANT_EMAIL],
    [
        'name' => 'Consultant Synthetic RCIC',
        'password' => Hash::make(STAGE_G_CONSULTANT_PASSWORD),
        'rcic_number' => 'R999999999',
        'company_name' => 'RCICMASTER Stage G',
        'email_verified_at' => now(),
        'is_verified' => true,
    ],
);
if (! $consultant->hasRole('rcic')) {
    $consultant->assignRole('rcic');
}

$otherConsultant = User::updateOrCreate(
    ['email' => 'stageg.other.consultant@rcicmaster.test'],
    [
        'name' => 'Other Stage G RCIC',
        'password' => Hash::make(STAGE_G_CONSULTANT_PASSWORD),
        'rcic_number' => 'R888888888',
        'company_name' => 'Other Firm',
        'email_verified_at' => now(),
        'is_verified' => true,
    ],
);
if (! $otherConsultant->hasRole('rcic')) {
    $otherConsultant->assignRole('rcic');
}

$client = User::updateOrCreate(
    ['email' => STAGE_G_CLIENT_EMAIL],
    [
        'name' => 'Synthetic STAGEGTEST',
        'password' => Hash::make('StageGClient123!'),
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
        'case_number' => 5476,
        'name' => 'Stage G IMM5476 Verification Case',
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

// Clear prior Stage G generations for clean run
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
            'passportFullName' => 'Synthetic STAGEGTEST',
            'dob' => '1990-06-15',
        ],
        'step1_data' => [
            'email' => STAGE_G_CLIENT_EMAIL,
            'phone' => '+1-416-555-0199',
        ],
        'is_submitted' => true,
        'submitted_at' => now(),
    ],
);

echo json_encode([
    'consultant_email' => STAGE_G_CONSULTANT_EMAIL,
    'consultant_password' => STAGE_G_CONSULTANT_PASSWORD,
    'other_consultant_email' => $otherConsultant->email,
    'client_email' => STAGE_G_CLIENT_EMAIL,
    'profile_id' => $profile->id,
    'case_file_id' => $case->id,
    'consultant_id' => $consultant->id,
    'synthetic' => [
        'applicant_given' => 'Synthetic',
        'applicant_family' => 'STAGEGTEST',
        'representative_given' => 'Consultant',
        'representative_family' => 'Synthetic RCIC',
        'rcic_number' => 'R999999999',
        'firm' => 'RCICMASTER Stage G',
    ],
    'case_hub_url' => "http://localhost:3005/dashboard/clients/{$profile->id}/workspace/case-management",
], JSON_PRETTY_PRINT).PHP_EOL;
