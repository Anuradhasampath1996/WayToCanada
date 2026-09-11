<?php

$backendRoot = dirname(__DIR__); // Laravel app root (/var/www in API image)
$monorepoRoot = dirname($backendRoot);

$firstExisting = static function (array $candidates, ?string $fallback = null): string {
    foreach ($candidates as $path) {
        if (is_string($path) && $path !== '' && is_file($path)) {
            return $path;
        }
    }

    foreach ($candidates as $path) {
        if (is_string($path) && $path !== '') {
            return $path;
        }
    }

    return $fallback ?? '';
};

$fixture = static function (string $filename) use ($backendRoot, $monorepoRoot, $firstExisting): string {
    return $firstExisting([
        $backendRoot.'/form-processor/fixtures/'.$filename,
        $monorepoRoot.'/form-processor-poc/fixtures/'.$filename,
        $backendRoot.'/../form-processor-poc/fixtures/'.$filename,
    ], $backendRoot.'/form-processor/fixtures/'.$filename);
};

$jarPath = $firstExisting([
    env('GOVERNMENT_FORM_PROCESSOR_JAR'),
    $backendRoot.'/form-processor/government-form-poc-itext-0.1.0-SNAPSHOT.jar',
    $monorepoRoot.'/form-processor-poc/java-itext/target/government-form-poc-itext-0.1.0-SNAPSHOT.jar',
    $backendRoot.'/../form-processor-poc/java-itext/target/government-form-poc-itext-0.1.0-SNAPSHOT.jar',
], $backendRoot.'/form-processor/government-form-poc-itext-0.1.0-SNAPSHOT.jar');

return [
    'processor' => [
        'driver'          => env('GOVERNMENT_FORM_PROCESSOR_DRIVER', 'jar'),
        'base_url'        => env('GOVERNMENT_FORM_PROCESSOR_URL', 'http://127.0.0.1:8091'),
        'api_token'       => env('GOVERNMENT_FORM_PROCESSOR_TOKEN'),
        'timeout_seconds' => (int) env('GOVERNMENT_FORM_PROCESSOR_TIMEOUT', 120),
        'connect_timeout' => (int) env('GOVERNMENT_FORM_PROCESSOR_CONNECT_TIMEOUT', 10),
        'java_binary'     => env('GOVERNMENT_FORM_PROCESSOR_JAVA', 'java'),
        'jar_path'        => $jarPath,
        'python_binary'       => env('GOVERNMENT_FORM_PROCESSOR_PYTHON', 'python'),
        'validation_script'   => $firstExisting([
            $monorepoRoot.'/form-processor-poc/python/validate_pdfxfa_output.py',
            $backendRoot.'/../form-processor-poc/python/validate_pdfxfa_output.py',
        ], $monorepoRoot.'/form-processor-poc/python/validate_pdfxfa_output.py'),
    ],

    'storage' => [
        'templates' => 'government-forms/templates',
        'generated' => 'government-forms/generated',
        'temp'      => 'government-forms/temp',
    ],

    'licensing' => [
        'production_blocked' => true,
        'note' => 'Commercial iText Core + pdfXFA licensing required before production deployment.',
    ],

    'supported_forms' => [
        'IMM5476' => [
            'name'            => 'Use of a Representative',
            'version_label'   => '11-2025',
            'template_sha256' => 'aca5c476b93d1c496b1afbc2cfe843499e852e31dcf0c192153bd01f8d6c56c4',
            'xfa_root'        => 'IMM_5476',
            'datasets_skeleton' => $fixture('imm5476_datasets_skeleton.xml'),
        ],
        'IMM5406' => [
            'name'            => 'Additional Family Information',
            'version_label'   => '05-2026',
            'template_sha256' => '4f544818e48b7355b2b7bb0dc89feed47fdd7e7ce836075b5d3c9489ed315b27',
            'xfa_root'        => 'IMM_5406',
        ],
        'IMM0008' => [
            'name'              => 'Generic Application Form for Canada',
            'version_label'     => '05-2026',
            'template_sha256'   => '2560489b57160f59c54a58d2f837d220a0426285ec17465c487b6fe2a5f63285',
            'xfa_root'          => 'form1',
            'datasets_skeleton' => $fixture('imm0008_datasets_skeleton.xml'),
        ],
        'IMM5562' => [
            'name'              => 'Supplementary Information — Your Travels',
            'version_label'     => '07-2024',
            'template_sha256'   => 'aeb0b9ae7322c847b03429fcf8c05efb595d59f5992bd54b1d67fd0b2bd3d52e',
            'xfa_root'          => 'IMM_5562',
            'datasets_skeleton' => $fixture('imm5562_datasets_skeleton.xml'),
        ],
        'IMM5669' => [
            'name'              => 'Schedule A — Background/Declaration',
            'version_label'     => '05-2021',
            'template_sha256'   => '4bdc23bb6a9dfa3731927f9b93295fb14008ee504d02b3037e349c4cda421f7a',
            'xfa_root'          => 'IMM_5669',
            'datasets_skeleton' => $fixture('imm5669_datasets_skeleton.xml'),
        ],
        'IMM1294' => [
            'name'              => 'Application for a Study Permit Made Outside of Canada',
            'version_label'     => '06-2026',
            'template_sha256'   => '394c745501ef87e46a0b15618ca342387ca06c5b2f226face2956b0372047d09',
            'xfa_root'          => 'form1',
            'datasets_skeleton' => $fixture('imm1294_datasets_skeleton.xml'),
        ],
        'IMM1295' => [
            'name'              => 'Application for a Work Permit Made Outside of Canada',
            'version_label'     => '09-2023',
            'template_sha256'   => '57fc256eef7d9d856e4ae85ebf8bfe80da41833ebde7a8c7ed78f2483470d7bb',
            'xfa_root'          => 'form1',
            'datasets_skeleton' => $fixture('imm1295_datasets_skeleton.xml'),
        ],
        'IMM5707' => [
            'name'              => 'Family Information — Visitors, Students and Workers',
            'version_label'     => '01-2023',
            'template_sha256'   => '6e59d35048ef3995e1d4583f08c38a710a351e23b1cc0fbfe517d82f38cb20ef',
            'xfa_root'          => 'IMM_5707',
            'datasets_skeleton' => $fixture('imm5707_datasets_skeleton.xml'),
        ],
    ],

    /*
    | Official Canada.ca form pages used by Admin Official Forms Sync.
    | Keys are uppercase form codes matching supported_forms.
    */
    'official_page_urls' => [
        'IMM5476' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5476.html',
        'IMM5406' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5406.html',
        'IMM0008' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm0008.html',
        'IMM5562' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5562.html',
        'IMM5669' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5669.html',
        'IMM1294' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm1294.html',
        'IMM1295' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm1295.html',
        'IMM5707' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5707.html',
    ],

    'capacity' => [
        'IMM5406' => [
            'children'  => 3,
            'siblings'  => 3,
            'parents'   => 2,
        ],
    ],

    'readiness' => [
        'IMM5476' => [
            [
                'key' => 'applicant.personal.family_name',
                'label' => 'Applicant family name',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.given_names',
                'label' => 'Applicant given names',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'representative.personal.family_name',
                'label' => 'Representative family name',
                'source_section' => 'consultant_profile',
                'responsible_party' => 'consultant',
                'redirect_hint' => '/consultant/profile',
                'conditional' => false,
            ],
            [
                'key' => 'representative.personal.given_names',
                'label' => 'Representative given names',
                'source_section' => 'consultant_profile',
                'responsible_party' => 'consultant',
                'redirect_hint' => '/consultant/profile',
                'conditional' => false,
            ],
            [
                'key' => 'representative.rcic_number',
                'label' => 'RCIC licence number',
                'source_section' => 'consultant_profile',
                'responsible_party' => 'consultant',
                'redirect_hint' => '/consultant/profile',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.date_of_birth',
                'label' => 'Applicant date of birth',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
        ],
        'IMM5406' => [
            [
                'key' => 'applicant.personal.family_name',
                'label' => 'Applicant family name',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.given_names',
                'label' => 'Applicant given names',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.date_of_birth',
                'label' => 'Applicant date of birth',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.country_of_birth',
                'label' => 'Applicant country of birth',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.address.full',
                'label' => 'Applicant address',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.marital_status',
                'label' => 'Applicant marital status',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.contact.email',
                'label' => 'Applicant email',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.family.parent1.family_name',
                'label' => 'Parent 1 family name',
                'source_section' => 'questionnaire_accompanying',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/accompanying',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.family.parent1.given_names',
                'label' => 'Parent 1 given names',
                'source_section' => 'questionnaire_accompanying',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/accompanying',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.family.parent1.date_of_birth',
                'label' => 'Parent 1 date of birth',
                'source_section' => 'questionnaire_accompanying',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/accompanying',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.family.parent2.family_name',
                'label' => 'Parent 2 family name',
                'source_section' => 'questionnaire_accompanying',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/accompanying',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.family.parent2.given_names',
                'label' => 'Parent 2 given names',
                'source_section' => 'questionnaire_accompanying',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/accompanying',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.family.parent2.date_of_birth',
                'label' => 'Parent 2 date of birth',
                'source_section' => 'questionnaire_accompanying',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/accompanying',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.family.children.0.family_name',
                'label' => 'First child family name',
                'source_section' => 'questionnaire_children',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/children',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.family.children.0.given_names',
                'label' => 'First child given names',
                'source_section' => 'questionnaire_children',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/children',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.family.children.0.date_of_birth',
                'label' => 'First child date of birth',
                'source_section' => 'questionnaire_children',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/children',
                'conditional' => false,
            ],
        ],
        'IMM0008' => [
            [
                'key' => 'applicant.personal.family_name',
                'label' => 'Applicant family name',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.given_names',
                'label' => 'Applicant given names',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.date_of_birth',
                'label' => 'Applicant date of birth',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.contact.email',
                'label' => 'Applicant email',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.gender',
                'label' => 'Applicant sex / gender',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.citizenship',
                'label' => 'Applicant citizenship',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.passport.expiry_date',
                'label' => 'Passport expiry date',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
        ],
        'IMM5562' => [
            [
                'key' => 'applicant.personal.family_name',
                'label' => 'Applicant family name',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.given_names',
                'label' => 'Applicant given names',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
        ],
        'IMM1294' => [
            [
                'key' => 'applicant.personal.family_name',
                'label' => 'Applicant family name',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.given_names',
                'label' => 'Applicant given names',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.contact.email',
                'label' => 'Applicant email',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
        ],
        'IMM1295' => [
            [
                'key' => 'applicant.personal.family_name',
                'label' => 'Applicant family name',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.given_names',
                'label' => 'Applicant given names',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.contact.email',
                'label' => 'Applicant email',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
        ],
        'IMM5707' => [
            [
                'key' => 'applicant.personal.family_name',
                'label' => 'Applicant family name',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.given_names',
                'label' => 'Applicant given names',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.date_of_birth',
                'label' => 'Applicant date of birth',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
        ],
        'IMM5669' => [
            [
                'key' => 'applicant.personal.family_name',
                'label' => 'Applicant family name',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.given_names',
                'label' => 'Applicant given names',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
            [
                'key' => 'applicant.personal.date_of_birth',
                'label' => 'Applicant date of birth',
                'source_section' => 'questionnaire_main',
                'responsible_party' => 'client',
                'redirect_hint' => '/questionnaire/main',
                'conditional' => false,
            ],
        ],
    ],
];
