<?php

/**
 * Live-safe QA client seed for anuradhasampath666@gmail.com.
 * Avoids pathway_code / PathwayCatalog (not migrated on production yet).
 *
 * Run inside API container:
 *   php /tmp/seed-qa-pathway-clients-live.php
 */

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use App\Services\CaseFileLifecycleService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

const CONSULTANT_EMAIL = 'anuradhasampath666@gmail.com';
const PASSWORD = 'QaPathway123!';

$clients = [
    ['pathway' => 'Express Entry – Federal Skilled Worker', 'email' => 'qa.pathway.ee-fsw@waytocanada.test', 'name' => 'QA EE FSW Client', 'stage' => 'pathway_package'],
    ['pathway' => 'Express Entry – Canadian Experience Class', 'email' => 'qa.pathway.ee-cec@waytocanada.test', 'name' => 'QA EE CEC Client', 'stage' => 'pathway_package'],
    ['pathway' => 'Express Entry – Federal Skilled Trades', 'email' => 'qa.pathway.ee-fst@waytocanada.test', 'name' => 'QA EE FST Client', 'stage' => 'pathway_package'],
    ['pathway' => 'Provincial Nominee Program', 'email' => 'qa.pathway.pnp@waytocanada.test', 'name' => 'QA PNP Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'Ontario OINP', 'email' => 'qa.pathway.pnp-on@waytocanada.test', 'name' => 'QA Ontario OINP Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'Study Permit', 'email' => 'qa.pathway.study@waytocanada.test', 'name' => 'QA Study Permit Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'Work Permit', 'email' => 'qa.pathway.work@waytocanada.test', 'name' => 'QA Work Permit Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'Family Sponsorship – Spouse / Common-law Partner', 'email' => 'qa.pathway.family@waytocanada.test', 'name' => 'QA Family Spouse Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'Family Sponsorship – Parents and Grandparents', 'email' => 'qa.pathway.family-pgp@waytocanada.test', 'name' => 'QA Family PGP Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'RCIP → Thunder Bay', 'email' => 'qa.pathway.rcip-thunder-bay@waytocanada.test', 'name' => 'QA RCIP Thunder Bay Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'FCIP → Sudbury', 'email' => 'qa.pathway.fcip-sudbury@waytocanada.test', 'name' => 'QA FCIP Sudbury Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'AIP – Nova Scotia', 'email' => 'qa.pathway.aip-ns@waytocanada.test', 'name' => 'QA AIP Nova Scotia Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'Quebec – Skilled Worker (PSTQ / Arrima)', 'email' => 'qa.pathway.quebec-pstq@waytocanada.test', 'name' => 'QA Quebec PSTQ Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'Start-up Visa', 'email' => 'qa.pathway.business-startup@waytocanada.test', 'name' => 'QA Start-up Visa Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'OINP – Employer Job Offer', 'email' => 'qa.pathway.oinp-job-offer@waytocanada.test', 'name' => 'QA OINP Job Offer Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'Visitor Visa (TRV)', 'email' => 'qa.pathway.visitor@waytocanada.test', 'name' => 'QA Visitor Visa Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'Super Visa (Parents and Grandparents)', 'email' => 'qa.pathway.super-visa@waytocanada.test', 'name' => 'QA Super Visa Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'Canadian Citizenship (Grant)', 'email' => 'qa.pathway.citizenship@waytocanada.test', 'name' => 'QA Citizenship Client', 'stage' => 'signed_unlocked'],
    ['pathway' => 'PR Card Renew / Replace', 'email' => 'qa.pathway.pr-card@waytocanada.test', 'name' => 'QA PR Card Client', 'stage' => 'signed_unlocked'],
];

$consultant = User::where('email', CONSULTANT_EMAIL)->first();
if (! $consultant) {
    fwrite(STDERR, "Consultant ".CONSULTANT_EMAIL." not found.\n");
    exit(1);
}

$lifecycle = app(CaseFileLifecycleService::class);
$created = 0;

foreach ($clients as $spec) {
    $user = User::updateOrCreate(
        ['email' => $spec['email']],
        [
            'name' => $spec['name'],
            'phone' => '+1 416 555 '.str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT),
            'password' => Hash::make(PASSWORD),
            'email_verified_at' => now(),
            'is_verified' => true,
            'consultant_id' => $consultant->id,
        ]
    );

    if (method_exists($user, 'hasRole') && ! $user->hasRole('client')) {
        $user->assignRole('client');
    }

    $profile = ClientProfile::updateOrCreate(
        [
            'user_id' => $user->id,
            'consultant_id' => $consultant->id,
        ],
        [
            'phone' => $user->phone,
            'immigration_pathway' => $spec['pathway'],
            'notes' => 'QA pathway flow seed — '.$spec['pathway'],
            'invited_at' => now(),
        ]
    );

    $case = $lifecycle->resolveActiveCaseFile($profile, $consultant->id, createIfMissing: true);
    if (! $case) {
        echo "FAIL case {$spec['email']}\n";
        continue;
    }

    $slug = Str::slug(Str::before($spec['email'], '@'));
    QuestionnaireSubmission::updateOrCreate(
        ['user_id' => $user->id],
        [
            'step1_data' => [
                'fullName' => $spec['name'],
                'email' => $spec['email'],
                'whatsapp' => '+1 416 555 0100',
                'visaType' => str_contains($spec['pathway'], 'Study') || str_contains($spec['pathway'], 'Work')
                    ? 'temporary'
                    : 'pr',
                'married' => 'yes',
                'dependentChildren' => '0',
                'hasAccompanying' => 'no',
            ],
            'main_data' => [
                'fullName' => $spec['name'],
                'passportFullName' => $spec['name'],
                'dob' => '1990-04-12',
                'passportNumber' => 'QA'.strtoupper(substr(md5($spec['email']), 0, 7)),
                'passportIssueDate' => '2019-06-01',
                'passportExpiry' => '2029-06-01',
                'passportNationality' => 'Sri Lankan',
                'passportGender' => 'Male',
                'birthCountry' => 'Sri Lanka',
                'addressLine1' => '100 Queen Street West',
                'city' => 'Toronto',
                'countryOfResidence' => str_contains($spec['pathway'], 'Canadian Experience') ? 'Canada' : 'Sri Lanka',
                'languageTest' => 'yes',
                'languageTestType' => 'ielts',
                'scores' => ['listening' => '8.0', 'reading' => '7.5', 'writing' => '7.0', 'speaking' => '7.5'],
                'intendedNocCode' => '21231',
                'intendedNocTitle' => 'Software engineers and designers',
                'settlementFunds' => '25000',
                'workExperience' => '3_or_more',
                'studiedInCanada' => str_contains($spec['pathway'], 'Study') || str_contains($spec['pathway'], 'Canadian Experience') ? 'yes' : 'no',
                'canadianWork' => str_contains($spec['pathway'], 'Canadian Experience') ? 'yes' : 'no',
                'provincialNomination' => str_contains($spec['pathway'], 'Provincial') ? 'yes' : 'no',
            ],
            'spouse_data' => [
                'fullName' => 'QA Spouse '.$slug,
                'passportFullName' => 'QA Spouse '.$slug,
                'dob' => '1992-08-20',
                'passportNumber' => 'SP'.strtoupper(substr(md5($spec['email']), 0, 7)),
                'passportNationality' => 'Sri Lankan',
                'passportGender' => 'Female',
            ],
            'children_data' => [],
            'accompanying_data' => [],
            'step3_data' => [
                'eduLevels' => ['bachelors'],
                'workCategory' => 'skilled',
                'fundsLkrRange' => 'above_5m',
                'hasJobOffer' => 'no',
                'hasMedicalCondition' => 'no',
            ],
            'verified_fields' => [],
            'field_remarks' => [],
            'is_submitted' => true,
            'submitted_at' => now(),
        ]
    );

    $updates = [
        'immigration_pathway' => $spec['pathway'],
        'status' => 'PATHWAY_SELECTED',
        'agreement_token' => null,
        'agreement_sent_at' => null,
        'agreement_signed_at' => null,
        'application_forms_verified_at' => null,
        'assigned_ircc_category_id' => null,
        'application_package_assigned_at' => null,
    ];

    if ($spec['stage'] === 'signed_unlocked') {
        $updates = array_merge($updates, [
            'agreement_token' => (string) Str::uuid(),
            'agreement_sent_at' => now()->subDay(),
            'agreement_signed_at' => now()->subHours(2),
            'status' => 'AGREEMENT_SIGNED',
        ]);
    }

    $case->update($updates);
    $created++;
    echo "OK {$spec['email']} → {$spec['pathway']} [{$spec['stage']}]\n";
}

echo "\nDone. Seeded/updated {$created} clients under ".CONSULTANT_EMAIL."\n";
echo "Password for all: ".PASSWORD."\n";
echo "Consultant client profiles now: ".ClientProfile::where('consultant_id', $consultant->id)->count()."\n";
