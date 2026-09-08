<?php

/**
 * Seed a full questionnaire (all fields + synthetic documents) for a client profile.
 * Every visible input for main / spouse / children / accompanying parents is filled.
 *
 * Usage: php scripts/seed-questionnaire-profile.php [profile_id]
 */

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Support\ClientDocumentStorage;
use Illuminate\Support\Facades\Storage;

$profileId = (int) ($argv[1] ?? 15);

$profile = ClientProfile::with('user')->find($profileId);
if (! $profile || ! $profile->user) {
    fwrite(STDERR, "Client profile {$profileId} not found.\n");
    exit(1);
}

$clientName = $profile->user->name ?: 'Anuradha Sampath';
$clientEmail = $profile->user->email;
$slug = preg_replace('/[^a-z0-9]+/i', '-', strtolower($clientName)) ?: 'client';
$slug = trim($slug, '-') ?: 'client';

function minimalPdf(string $title): string
{
    $content = "Sample document: {$title}";
    $stream = <<<PDF
%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 72 720 Td ({$content}) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000370 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
441
%%EOF
PDF;

    return $stream;
}

function minimalPng(): string
{
    if (function_exists('imagecreatetruecolor')) {
        $img = imagecreatetruecolor(640, 400);
        $bg = imagecolorallocate($img, 245, 247, 250);
        $fg = imagecolorallocate($img, 30, 41, 59);
        imagefilledrectangle($img, 0, 0, 640, 400, $bg);
        imagestring($img, 5, 24, 180, 'Synthetic ID scan (dev seed)', $fg);
        ob_start();
        imagepng($img);
        imagedestroy($img);

        return ob_get_clean() ?: '';
    }

    return base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
}

function storeSyntheticDocument(string $label, string $ext = 'pdf'): string
{
    $safe = preg_replace('/[^a-z0-9._-]+/i', '-', strtolower($label)) ?: 'document';
    $filename = "{$safe}.{$ext}";
    $path = ClientDocumentStorage::buildPath('client-document', $filename);
    $disk = Storage::disk(ClientDocumentStorage::DISK_LOCAL);
    $bytes = $ext === 'png' ? minimalPng() : minimalPdf($label);
    $disk->put($path, $bytes);

    return $path;
}

function personDocuments(string $prefix): array
{
    return [
        'passportName'           => storeSyntheticDocument("{$prefix}-passport", 'pdf'),
        'governmentIdName'       => storeSyntheticDocument("{$prefix}-gov-id-front", 'png'),
        'governmentIdBackName'   => storeSyntheticDocument("{$prefix}-gov-id-back", 'png'),
        'drivingLicenseName'     => storeSyntheticDocument("{$prefix}-license-front", 'png'),
        'drivingLicenseBackName' => storeSyntheticDocument("{$prefix}-license-back", 'png'),
    ];
}

function personIdentity(
    string $fullName,
    string $dob,
    string $prefix,
    string $gender,
    string $passportNumber,
    string $nicNumber,
): array {
    return array_merge([
        'fullName'            => $fullName,
        'dob'                 => $dob,
        'passportFullName'    => $fullName,
        'passportNumber'      => $passportNumber,
        'passportIssueDate'   => '2019-06-01',
        'passportExpiry'      => '2029-06-01',
        'passportNationality' => 'Sri Lankan',
        'passportGender'      => $gender,
        'nicFullName'         => $fullName,
        'nicNumber'           => $nicNumber,
        'nicDob'              => $dob,
        'nicAddress'          => '42 Maple Street, Colombo 05, Sri Lanka',
        'nicBirthPlace'       => 'Colombo, Sri Lanka',
        'nicIssueDate'        => '2018-03-15',
        'languages'           => ['English', 'Sinhala'],
    ], personDocuments($prefix));
}

function eduQual(string $level, string $uni, string $course, string $year, string $country, string $docPrefix): array
{
    return [
        'level'          => $level,
        'universityName' => $uni,
        'courseName'     => $course,
        'graduationYear' => $year,
        'country'        => $country,
        'documentName'   => storeSyntheticDocument("{$docPrefix}-{$level}-transcript", 'pdf'),
    ];
}

function workEntry(
    string $company,
    string $title,
    string $country,
    string $city,
    string $start,
    string $end,
    string $currently,
    string $duties,
): array {
    return [
        'companyName'      => $company,
        'jobTitle'         => $title,
        'country'          => $country,
        'city'             => $city,
        'startDate'        => $start,
        'endDate'          => $end,
        'currentlyWorking' => $currently,
        'duties'           => $duties,
    ];
}

// Exact names shown on questionnaire-review tabs
$mainName = $clientName; // Anuradha Sampath
$spouseName = 'Priya anuradha-sampath';
$child1Name = 'widget pixels';
$child2Name = 'widget pixels 02';
$fatherName = 'sampath sampath';
$motherName = 'widgetpixels mother';

$mainData = array_merge(
    personIdentity($mainName, '1990-04-12', "{$slug}-main", 'Male', 'N1234567', '199004123456'),
    [
        'birthCountry'                 => 'Sri Lanka',
        'addressLine1'                 => '88 Bay Street, Unit 1204',
        'city'                         => 'Toronto',
        'countryOfResidence'           => 'Canada',
        'educationLevels'              => ['bachelors', 'masters'],
        'educationQuals'               => [
            eduQual('bachelors', 'University of Colombo', 'BSc Computer Science', '2012', 'Sri Lanka', "{$slug}-main"),
            eduQual('masters', 'University of Toronto', 'MBA', '2023', 'Canada', "{$slug}-main"),
        ],
        'studiedInCanada'              => 'yes',
        'canadaStudyInstitution'       => 'University of Toronto',
        'canadaStudyProgram'           => 'Master of Business Administration',
        'canadaStudyCity'              => 'Toronto',
        'canadaStudyStart'             => '2021-09-01',
        'canadaStudyEnd'               => '2023-05-30',
        'canadaStudyDocName'           => storeSyntheticDocument("{$slug}-study-proof", 'pdf'),
        'languageTest'                 => 'yes',
        'languageTestType'             => 'ielts',
        'scores'                       => ['listening' => '8.5', 'reading' => '8.0', 'writing' => '7.5', 'speaking' => '8.0'],
        'languageTestDocName'          => storeSyntheticDocument("{$slug}-ielts-cert", 'pdf'),
        'frenchTestTaken'              => 'yes',
        'frenchTestType'               => 'tef',
        'frenchScores'                 => ['listening' => '250', 'reading' => '240', 'writing' => '350', 'speaking' => '310'],
        'intendedNocCode'              => '21231',
        'intendedNocTeer'              => '1',
        'intendedNocTitle'             => 'Software engineers and designers',
        'tradeCertificate'             => 'no',
        'provincialNominationInterest' => 'yes',
        'provincialNomination'         => 'no',
        'workExperience'               => '3_or_more',
        'foreignWorkEntries'           => [
            workEntry(
                'Tech Lanka Pvt Ltd',
                'Senior Software Engineer',
                'Sri Lanka',
                'Colombo',
                '2018-01-01',
                '2023-12-31',
                'no',
                'Designed and delivered backend APIs, led a team of 5 engineers, and maintained production systems.',
            ),
        ],
        'settlementFunds'              => '25000',
        'canadianWork'                 => 'yes',
        'canadianWorkEmployer'         => 'Maple Tech Solutions Inc.',
        'canadianWorkTitle'            => 'Software Developer',
        'canadianWorkCity'             => 'Toronto',
        'canadianWorkStart'            => '2024-01-15',
        'canadianWorkEnd'              => '2024-12-31',
        'jobOffer'                     => 'yes',
        'jobOfferEmployer'             => 'Northern Digital Corp.',
        'jobOfferTitle'                => 'Software Engineer',
        'jobOfferNoc'                  => '21231',
        'jobOfferProvince'             => 'Ontario',
        'canadianRelatives'            => 'yes',
        'relativeFullName'             => 'Sunil Perera',
        'relativeRelationship'         => 'Sibling',
        'relativeCity'                 => 'Mississauga',
        'relativeStatus'               => 'pr',
    ]
);

$spouseData = array_merge(
    personIdentity($spouseName, '1992-08-20', "{$slug}-spouse", 'Female', 'P8765432', '199208209876'),
    [
        'educationLevels'      => ['bachelors'],
        'educationQuals'       => [
            eduQual('bachelors', 'University of Kelaniya', 'BA English', '2015', 'Sri Lanka', "{$slug}-spouse"),
        ],
        'languageTest'         => 'yes',
        'languageTestType'     => 'ielts',
        'scores'               => ['listening' => '7.5', 'reading' => '7.0', 'writing' => '6.5', 'speaking' => '7.0'],
        'languageTestDocName'  => storeSyntheticDocument("{$slug}-spouse-ielts", 'pdf'),
        'frenchTestTaken'      => 'yes',
        'frenchTestType'       => 'tef',
        'frenchScores'         => ['listening' => '200', 'reading' => '190', 'writing' => '280', 'speaking' => '260'],
        'workExperience'       => '3_or_more',
        'foreignWorkEntries'   => [
            workEntry(
                'Colombo Language Centre',
                'English Teacher',
                'Sri Lanka',
                'Colombo',
                '2016-03-01',
                '2022-11-30',
                'no',
                'Taught IELTS preparation classes and managed student assessments.',
            ),
        ],
        'canadianWork'         => 'yes',
        'canadianWorkEmployer' => 'Toronto Language Hub',
        'canadianWorkTitle'    => 'ESL Instructor',
        'canadianWorkCity'     => 'Toronto',
        'canadianWorkStart'    => '2024-02-01',
        'canadianWorkEnd'      => '2024-12-31',
    ]
);

$childrenData = [
    array_merge(
        personIdentity($child1Name, '2016-02-14', "{$slug}-child-1", 'Male', 'C1111222', '201602141111'),
        [
            'name'           => $child1Name,
            'educationLevel' => 'secondary',
            'relationship'   => 'Child',
        ]
    ),
    array_merge(
        personIdentity($child2Name, '2018-09-03', "{$slug}-child-2", 'Female', 'C3333444', '201809033333'),
        [
            'name'           => $child2Name,
            'educationLevel' => 'secondary',
            'relationship'   => 'Child',
        ]
    ),
];

$accompanyingData = [
    array_merge(
        personIdentity($fatherName, '1962-11-05', "{$slug}-father", 'Male', 'F5555666', '196211055555'),
        [
            'relationship'      => 'father',
            'otherRelationship' => 'N/A',
        ]
    ),
    array_merge(
        personIdentity($motherName, '1965-07-18', "{$slug}-mother", 'Female', 'M7777888', '196507187777'),
        [
            'relationship'      => 'mother',
            'otherRelationship' => 'N/A',
        ]
    ),
];

$step1Data = [
    'fullName'          => $mainName,
    'email'             => $clientEmail,
    'whatsapp'          => '+14165551234',
    'visaType'          => 'pr',
    'married'           => 'yes',
    'dependentChildren' => '2',
    'hasAccompanying'   => 'yes',
    'accompanyingCount' => '2',
];

$step3Data = [
    'eduLevels'           => ['Bachelor', 'Master'],
    'eduQualifications'   => ['BSc Computer Science', 'MBA'],
    'spouseEduLevel'      => 'Bachelor',
    'currentJobTitle'     => 'Software Developer',
    'currentJobField'     => 'Information Technology',
    'totalExpYears'       => '6',
    'continuousFullTime'  => 'yes',
    'workCategory'        => 'skilled',
    'spouseExpYears'      => '4',
    'intlTestTaken'       => 'yes',
    'intlTestType'        => 'IELTS',
    'intlTestScores'      => ['listening' => '8.5', 'reading' => '8.0', 'writing' => '7.5', 'speaking' => '8.0'],
    'expectedClb'         => '9',
    'frenchProficiency'   => 'basic',
    'fundsLkrRange'       => '5_10m',
    'canInvestStudent'    => 'no',
    'relativeInCountry'   => 'yes',
    'prevEduAbroad'       => 'yes',
    'prevWorkAbroad'      => 'yes',
    'hasJobOffer'         => 'yes_lmia',
    'hasMedicalCondition' => 'no',
    'hasCriminalRecord'   => 'no',
    'hasVisaRefusal'      => 'no',
];

$submission = QuestionnaireSubmission::updateOrCreate(
    ['user_id' => $profile->user_id],
    [
        'step1_data'        => $step1Data,
        'main_data'         => $mainData,
        'spouse_data'       => $spouseData,
        'children_data'     => $childrenData,
        'accompanying_data' => $accompanyingData,
        'step3_data'        => $step3Data,
        'verified_fields'   => [],
        'field_remarks'     => [],
        'is_submitted'      => true,
        'submitted_at'      => now(),
    ],
);

/** Recursively collect empty leaf values (skip intentional N/A / structural empties already filled). */
function findEmptyPaths(mixed $data, string $prefix = ''): array
{
    $empty = [];
    if (! is_array($data)) {
        if ($data === null || $data === '') {
            $empty[] = $prefix ?: '(root)';
        }

        return $empty;
    }

    if ($data === []) {
        $empty[] = $prefix ?: '(empty-array)';

        return $empty;
    }

    foreach ($data as $key => $value) {
        $path = $prefix === '' ? (string) $key : "{$prefix}.{$key}";
        $empty = array_merge($empty, findEmptyPaths($value, $path));
    }

    return $empty;
}

$payload = [
    'step1'        => $step1Data,
    'main'         => $mainData,
    'spouse'       => $spouseData,
    'children'     => $childrenData,
    'accompanying' => $accompanyingData,
    'step3'        => $step3Data,
];
$emptyPaths = findEmptyPaths($payload);

echo json_encode([
    'message'       => 'Questionnaire seeded — all family members and fields filled.',
    'profile_id'    => $profile->id,
    'client_name'   => $clientName,
    'client_email'  => $clientEmail,
    'submission_id' => $submission->id,
    'members'       => [
        'main'   => $mainName,
        'spouse' => $spouseName,
        'child1' => $child1Name,
        'child2' => $child2Name,
        'father' => $fatherName,
        'mother' => $motherName,
    ],
    'empty_fields'  => $emptyPaths,
    'empty_count'   => count($emptyPaths),
    'review_url'    => "http://localhost:3005/dashboard/clients/{$profile->id}/workspace/questionnaire-review",
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n";

if ($emptyPaths !== []) {
    fwrite(STDERR, "WARNING: some fields are still empty:\n".implode("\n", $emptyPaths)."\n");
    exit(2);
}
