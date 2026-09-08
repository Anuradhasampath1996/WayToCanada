<?php

/**
 * Live generate + copy Adobe-check PDFs for newly activated forms.
 * Run: php artisan_live_generate_adobe.php
 */

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use App\Services\GovernmentForms\ApplicationInfoReviewService;
use App\Services\GovernmentForms\FormGenerationService;
use App\Services\GovernmentForms\GovernmentFormGenerationException;
use Illuminate\Support\Facades\File;

require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$forms = ['IMM0008', 'IMM5562', 'IMM5669', 'IMM1294', 'IMM1295', 'IMM5707'];

$jar = config('government_forms.processor.jar_path');
if (! is_file($jar)) {
    fwrite(STDERR, "JAR missing: {$jar}\nBuild with: mvn -f ../form-processor-poc/java-itext/pom.xml -DskipTests package\n");
    exit(1);
}

echo "Using JAR: {$jar}\n";

$kernel->call('db:seed', ['--class' => 'Database\\Seeders\\GovernmentFormVersionSeeder']);

$consultant = User::query()->whereNotNull('rcic_number')->whereHas('roles', fn ($q) => $q->where('name', 'rcic'))->first()
    ?? User::query()->whereNotNull('rcic_number')->first();

if (! $consultant) {
    fwrite(STDERR, "No consultant user found.\n");
    exit(1);
}

$clientUser = User::factory()->create([
    'name'  => 'Adobe Check Applicant',
    'email' => 'adobe-check-'.uniqid().'@example.test',
]);

$profile = ClientProfile::create([
    'user_id'       => $clientUser->id,
    'consultant_id' => $consultant->id,
]);

$caseFile = CaseFile::create([
    'client_profile_id'   => $profile->id,
    'consultant_id'       => $consultant->id,
    'case_number'         => random_int(1000, 32000),
    'name'                => 'Adobe Live Generate Check',
    'status'              => 'active',
    'lifecycle_status'    => 'in_progress',
    'immigration_pathway' => 'Express Entry — Federal Skilled Worker',
]);
$profile->update(['active_case_file_id' => $caseFile->id]);

QuestionnaireSubmission::create([
    'user_id' => $clientUser->id,
    'main_data' => [
        'passportFullName' => 'ADOBECHECK FAMILY',
        'passportNumber' => 'N1234567',
        'passportNationality' => 'Sri Lanka',
        'dob' => '1990-04-12',
        'uci' => '1122223333',
        'birthCountry' => 'Sri Lanka',
        'birthCity' => 'Colombo',
        'addressLine1' => '12 Adobe Street',
        'city' => 'Colombo',
        'province' => 'Western',
        'postalCode' => '00100',
        'countryOfResidence' => 'Sri Lanka',
        'languages' => ['Sinhala', 'English'],
        'educationLevels' => ['bachelors'],
        'intendedNocTitle' => 'Software Engineer',
        'nicNumber' => '900412123V',
        'travelHistory' => [
            [
                'fromDate' => '2019-06-01',
                'toDate' => '2019-06-20',
                'destination' => 'Singapore',
                'purpose' => 'Tourism',
                'details' => 'Family visit',
            ],
            [
                'fromDate' => '2022-01-10',
                'toDate' => '2022-01-18',
                'destination' => 'India',
                'purpose' => 'Business',
                'details' => 'Conference',
            ],
        ],
    ],
    'step1_data' => [
        'email' => $clientUser->email,
        'phone' => '0771234567',
        'married' => 'yes',
    ],
    'spouse_data' => [
        'fullName' => 'ADOBECHECK SPOUSE',
        'dob' => '1992-08-20',
        'birthCountry' => 'Sri Lanka',
        'email' => 'spouse-adobe@example.test',
    ],
    'children_data' => [[
        'fullName' => 'ADOBECHECK CHILD',
        'dob' => '2016-03-03',
        'birthCountry' => 'Sri Lanka',
        'relationship' => 'Child',
    ]],
    'accompanying_data' => [
        [
            'fullName' => 'ADOBECHECK FATHER',
            'dob' => '1960-01-01',
            'relationship' => 'father',
            'birthCountry' => 'Sri Lanka',
            'nicBirthPlace' => 'Kandy',
        ],
        [
            'fullName' => 'ADOBECHECK MOTHER',
            'dob' => '1962-02-02',
            'relationship' => 'mother',
            'birthCountry' => 'Sri Lanka',
            'nicBirthPlace' => 'Galle',
        ],
    ],
    'is_submitted' => true,
    'submitted_at' => now(),
]);

/** @var ApplicationInfoReviewService $review */
$review = app(ApplicationInfoReviewService::class);
$review->markReviewed($caseFile, $consultant);

/** @var FormGenerationService $generation */
$generation = app(FormGenerationService::class);

$outDir = dirname(base_path()).'/docs/government-forms-poc/adobe-live-check-'.date('Ymd-His');
File::ensureDirectoryExists($outDir);

$manifest = [
    'generated_at' => now()->toIso8601String(),
    'profile_id' => $profile->id,
    'case_file_id' => $caseFile->id,
    'consultant_id' => $consultant->id,
    'forms' => [],
];

foreach ($forms as $formCode) {
    echo "\n=== Generating {$formCode} ===\n";
    try {
        $result = $generation->generate($consultant, $profile, $formCode, null, true);
        $submission = $result['submission'];
        $src = storage_path('app/private/'.$submission->file_path);
        $dest = $outDir.'/'.$formCode.'-adobe-check.pdf';
        if (! is_file($src)) {
            throw new RuntimeException("Output missing: {$src}");
        }
        copy($src, $dest);
        $entry = [
            'ok' => true,
            'submission_id' => $submission->id,
            'private_path' => $submission->file_path,
            'adobe_copy' => $dest,
            'output_sha256' => $submission->output_sha256,
            'bytes' => filesize($dest),
            'ready' => $result['readiness']->ready ?? null,
        ];
        echo "OK → {$dest}\n";
        echo "SHA-256: {$submission->output_sha256}\n";
    } catch (GovernmentFormGenerationException|Throwable $e) {
        $entry = [
            'ok' => false,
            'error' => $e->getMessage(),
        ];
        echo 'FAIL: '.$e->getMessage()."\n";
    }
    $manifest['forms'][$formCode] = $entry;
}

file_put_contents($outDir.'/MANIFEST.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
echo "\nManifest: {$outDir}/MANIFEST.json\n";

$okFiles = [];
foreach ($manifest['forms'] as $code => $entry) {
    if (! empty($entry['ok']) && ! empty($entry['adobe_copy'])) {
        $okFiles[] = $entry['adobe_copy'];
    }
}

if ($okFiles === []) {
    echo "No PDFs to open.\n";
    exit(1);
}

// Prefer Adobe Acrobat / Reader if installed; else default association.
$adobeCandidates = [
    'C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe',
    'C:\\Program Files\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe',
    'C:\\Program Files (x86)\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe',
    'C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe',
];
$adobe = null;
foreach ($adobeCandidates as $cand) {
    if (is_file($cand)) {
        $adobe = $cand;
        break;
    }
}

echo "\nOpening ".count($okFiles)." PDF(s) for Adobe checklist...\n";
foreach ($okFiles as $pdf) {
    if ($adobe) {
        $cmd = '"'.$adobe.'" "'.$pdf.'"';
        pclose(popen('start "" '.$cmd, 'r'));
        echo "Opened with Adobe: {$pdf}\n";
    } else {
        // Windows shell association
        pclose(popen('start "" "'.$pdf.'"', 'r'));
        echo "Opened with default app: {$pdf}\n";
    }
    usleep(400000);
}

echo "\nAdobe checklist (manual):\n";
echo "1) Opens without repair/corruption warning\n";
echo "2) Populated values visible (look for ADOBECHECK / travel / languages)\n";
echo "3) Fields remain editable\n";
echo "4) Save → close → reopen retains values\n";
echo "5) Validate / Reset / Print behave normally if present\n";
echo "\nDone.\n";
