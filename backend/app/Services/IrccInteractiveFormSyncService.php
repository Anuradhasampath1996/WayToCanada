<?php

namespace App\Services;

use App\Models\IrccCategory;
use App\Models\IrccInteractiveForm;

class IrccInteractiveFormSyncService
{
    /** @var list<string> */
    public const ONLINE_ONLY_MARKERS = [
        'online form',
        'online web forms',
        'online-only',
        'dynamic e-apr',
    ];

    public static function isOnlineOnlyReference(?string $reference): bool
    {
        if ($reference === null || $reference === '') {
            return false;
        }

        $normalized = strtolower(trim($reference));

        if (in_array($normalized, ['none', 'n/a'], true)) {
            return false;
        }

        foreach (self::ONLINE_ONLY_MARKERS as $marker) {
            if ($normalized === $marker || str_contains($normalized, $marker)) {
                return true;
            }
        }

        return false;
    }

    public static function isOnlineOnlyPackage(IrccCategory $package): bool
    {
        if ($package->level !== 3 || empty($package->result)) {
            return false;
        }

        $result = $package->result;
        $hasPdfForm = false;
        $hasOnlineForm = false;

        foreach ($result['forms'] ?? [] as $form) {
            if (! $form || in_array(strtolower(trim($form)), ['none', 'n/a'], true)) {
                continue;
            }

            if (self::isOnlineOnlyReference($form)) {
                $hasOnlineForm = true;
            } else {
                $hasPdfForm = true;
            }
        }

        if ($hasOnlineForm && ! $hasPdfForm) {
            return true;
        }

        if (self::isOnlineOnlyReference($result['checklist'] ?? null) && ! $hasPdfForm) {
            return true;
        }

        return false;
    }

    /** @return list<string> */
    public static function syncablePdfReferences(array $result): array
    {
        $refs = [];

        if (! empty($result['guide']) && ! in_array(strtolower($result['guide']), ['none', 'n/a', 'dynamic e-apr'], true)
            && ! self::isOnlineOnlyReference($result['guide'])) {
            $refs[] = $result['guide'];
        }

        if (! empty($result['checklist']) && ! in_array(strtolower($result['checklist']), ['none', 'n/a', 'dynamic e-apr'], true)
            && ! self::isOnlineOnlyReference($result['checklist'])) {
            $refs[] = $result['checklist'];
        }

        foreach ($result['forms'] ?? [] as $form) {
            if ($form && ! in_array(strtolower($form), ['none', 'online form', 'online web forms'], true)
                && ! self::isOnlineOnlyReference($form)) {
                $refs[] = $form;
            }
        }

        return array_values(array_unique($refs));
    }

    /**
     * @return array{
     *   created:int,
     *   updated:int,
     *   unchanged:int,
     *   total:int,
     *   package_id:int,
     *   package_label:string,
     *   forms:array<int,array{slug:string,title:string,action:string}>,
     *   errors:array<int,string>
     * }
     */
    public function syncPackageForms(IrccCategory $package): array
    {
        $stats = [
            'created'        => 0,
            'updated'        => 0,
            'unchanged'      => 0,
            'total'          => 0,
            'package_id'     => $package->id,
            'package_label'  => $package->label,
            'forms'          => [],
            'errors'         => [],
        ];

        if (! self::isOnlineOnlyPackage($package)) {
            return $stats;
        }

        $templates = $this->templatesFor($package);

        if ($templates === []) {
            $stats['errors'][] = "No HTML form templates configured for \"{$package->label}\".";

            return $stats;
        }

        foreach ($templates as $formData) {
            $existing = IrccInteractiveForm::where('ircc_category_id', $package->id)
                ->where('slug', $formData['slug'])
                ->first();

            $payload = [
                'title'       => $formData['title'],
                'description' => $formData['description'] ?? null,
                'form_schema' => $formData['form_schema'],
                'sort_order'  => $formData['sort_order'],
                'is_active'   => true,
            ];

            if (! $existing) {
                IrccInteractiveForm::create(array_merge($payload, [
                    'ircc_category_id' => $package->id,
                    'slug'             => $formData['slug'],
                ]));
                $stats['created']++;
                $action = 'created';
            } else {
                $changed = $existing->title !== $payload['title']
                    || $existing->description !== $payload['description']
                    || (int) $existing->sort_order !== (int) $payload['sort_order']
                    || json_encode($existing->form_schema) !== json_encode($payload['form_schema']);

                if ($changed) {
                    $existing->update($payload);
                    $stats['updated']++;
                    $action = 'updated';
                } else {
                    $stats['unchanged']++;
                    $action = 'unchanged';
                }
            }

            $stats['total']++;
            $stats['forms'][] = [
                'slug'   => $formData['slug'],
                'title'  => $formData['title'],
                'action' => $action,
            ];
        }

        return $stats;
    }

    /**
     * @return array{
     *   packages:int,
     *   created:int,
     *   updated:int,
     *   unchanged:int,
     *   total_forms:int,
     *   package_results:array<int,array<string,mixed>>,
     *   errors:array<int,string>
     * }
     */
    public function syncAllOnlineOnlyPackages(): array
    {
        $stats = [
            'packages'        => 0,
            'created'         => 0,
            'updated'         => 0,
            'unchanged'       => 0,
            'total_forms'     => 0,
            'package_results' => [],
            'errors'          => [],
        ];

        $packages = IrccCategory::where('level', 3)
            ->orderBy('sort_order')
            ->get()
            ->filter(fn (IrccCategory $p) => self::isOnlineOnlyPackage($p));

        $stats['packages'] = $packages->count();

        foreach ($packages as $package) {
            $result = $this->syncPackageForms($package);
            $stats['created'] += $result['created'];
            $stats['updated'] += $result['updated'];
            $stats['unchanged'] += $result['unchanged'];
            $stats['total_forms'] += $result['total'];
            $stats['package_results'][] = $result;
            $stats['errors'] = array_merge($stats['errors'], $result['errors']);
        }

        return $stats;
    }

    /** @return list<IrccCategory> */
    public function onlineOnlyPackages(): array
    {
        return IrccCategory::where('level', 3)
            ->withCount(['interactiveForms as active_interactive_form_count' => fn ($q) => $q->where('is_active', true)])
            ->orderBy('sort_order')
            ->get()
            ->filter(fn (IrccCategory $p) => self::isOnlineOnlyPackage($p))
            ->values()
            ->all();
    }

    /** @return list<array<string, mixed>> */
    private function templatesFor(IrccCategory $package): array
    {
        $label = strtolower($package->label);

        if (str_contains($label, 'express entry')) {
            return self::expressEntryTemplates();
        }

        if (str_contains($label, 'electronic travel authorization') || str_contains($label, '(eta)')) {
            return self::etaTemplates();
        }

        return self::genericOnlineTemplates($package);
    }

    /** @return list<array<string, mixed>> */
    public static function expressEntryTemplates(): array
    {
        return [
            [
                'slug'        => 'express-entry-personal-details',
                'title'       => 'Express Entry — Personal Details',
                'description' => 'Collect personal information for the Express Entry profile and e-APR preparation. Replaces online-only IRCC web forms with no PDF download.',
                'sort_order'  => 1,
                'form_schema' => [
                    'fields' => [
                        ['type' => 'section', 'label' => 'Identity'],
                        ['type' => 'text', 'key' => 'family_name', 'label' => 'Family name (surname)', 'required' => true],
                        ['type' => 'text', 'key' => 'given_names', 'label' => 'Given name(s)', 'required' => true],
                        ['type' => 'date', 'key' => 'date_of_birth', 'label' => 'Date of birth', 'required' => true],
                        ['type' => 'select', 'key' => 'gender', 'label' => 'Gender', 'required' => true, 'options' => [
                            ['value' => 'female', 'label' => 'Female'],
                            ['value' => 'male', 'label' => 'Male'],
                            ['value' => 'other', 'label' => 'Another gender'],
                        ]],
                        ['type' => 'text', 'key' => 'city_of_birth', 'label' => 'City or town of birth', 'required' => true],
                        ['type' => 'text', 'key' => 'country_of_birth', 'label' => 'Country of birth', 'required' => true],
                        ['type' => 'text', 'key' => 'citizenship', 'label' => 'Citizenship(s)', 'required' => true],
                        ['type' => 'section', 'label' => 'Contact'],
                        ['type' => 'email', 'key' => 'email', 'label' => 'Email address', 'required' => true],
                        ['type' => 'tel', 'key' => 'phone', 'label' => 'Primary phone number', 'required' => true],
                        ['type' => 'textarea', 'key' => 'current_address', 'label' => 'Current residential address', 'required' => true],
                        ['type' => 'section', 'label' => 'Passport'],
                        ['type' => 'text', 'key' => 'passport_number', 'label' => 'Passport number', 'required' => true],
                        ['type' => 'date', 'key' => 'passport_issue_date', 'label' => 'Passport issue date', 'required' => true],
                        ['type' => 'date', 'key' => 'passport_expiry_date', 'label' => 'Passport expiry date', 'required' => true],
                        ['type' => 'text', 'key' => 'passport_country', 'label' => 'Passport country of issue', 'required' => true],
                    ],
                ],
            ],
            [
                'slug'        => 'express-entry-work-history',
                'title'       => 'Express Entry — Work History',
                'description' => 'Primary work experience details used for CRS and Express Entry profile.',
                'sort_order'  => 2,
                'form_schema' => [
                    'fields' => [
                        ['type' => 'section', 'label' => 'Current or most recent job'],
                        ['type' => 'text', 'key' => 'job_title', 'label' => 'Job title', 'required' => true],
                        ['type' => 'text', 'key' => 'noc_code', 'label' => 'NOC code (2021)', 'required' => true, 'help_text' => 'Example: 21231'],
                        ['type' => 'text', 'key' => 'employer_name', 'label' => 'Employer name', 'required' => true],
                        ['type' => 'text', 'key' => 'employer_city', 'label' => 'City', 'required' => true],
                        ['type' => 'text', 'key' => 'employer_country', 'label' => 'Country', 'required' => true],
                        ['type' => 'date', 'key' => 'work_start_date', 'label' => 'Start date', 'required' => true],
                        ['type' => 'date', 'key' => 'work_end_date', 'label' => 'End date (leave blank if current)'],
                        ['type' => 'checkbox', 'key' => 'currently_working', 'label' => 'I am currently working in this job'],
                        ['type' => 'textarea', 'key' => 'main_duties', 'label' => 'Main duties', 'required' => true],
                        ['type' => 'number', 'key' => 'hours_per_week', 'label' => 'Hours per week', 'required' => true],
                    ],
                ],
            ],
            [
                'slug'        => 'express-entry-education',
                'title'       => 'Express Entry — Education',
                'description' => 'Highest level of education and credential assessment details.',
                'sort_order'  => 3,
                'form_schema' => [
                    'fields' => [
                        ['type' => 'section', 'label' => 'Highest credential'],
                        ['type' => 'select', 'key' => 'education_level', 'label' => 'Level of education', 'required' => true, 'options' => [
                            ['value' => 'secondary', 'label' => 'Secondary diploma (high school)'],
                            ['value' => 'one_year', 'label' => 'One-year program at university/college'],
                            ['value' => 'two_year', 'label' => 'Two-year program at university/college'],
                            ['value' => 'bachelor', 'label' => "Bachelor's degree (3+ years)"],
                            ['value' => 'two_or_more', 'label' => 'Two or more certificates/diplomas/degrees'],
                            ['value' => 'masters', 'label' => "Master's degree or professional degree"],
                            ['value' => 'phd', 'label' => 'Doctoral level (PhD)'],
                        ]],
                        ['type' => 'text', 'key' => 'field_of_study', 'label' => 'Field of study / program name', 'required' => true],
                        ['type' => 'text', 'key' => 'institution_name', 'label' => 'Institution name', 'required' => true],
                        ['type' => 'text', 'key' => 'institution_country', 'label' => 'Country of study', 'required' => true],
                        ['type' => 'date', 'key' => 'education_start_date', 'label' => 'Start date', 'required' => true],
                        ['type' => 'date', 'key' => 'education_end_date', 'label' => 'End date / graduation date', 'required' => true],
                        ['type' => 'section', 'label' => 'ECA (if applicable)'],
                        ['type' => 'select', 'key' => 'eca_completed', 'label' => 'Have you completed an ECA?', 'required' => true, 'options' => [
                            ['value' => 'yes', 'label' => 'Yes'],
                            ['value' => 'no', 'label' => 'No'],
                            ['value' => 'in_progress', 'label' => 'In progress'],
                        ]],
                        ['type' => 'text', 'key' => 'eca_organization', 'label' => 'ECA organization (WES, IQAS, etc.)'],
                        ['type' => 'text', 'key' => 'eca_reference_number', 'label' => 'ECA reference number'],
                    ],
                ],
            ],
        ];
    }

    /** @return list<array<string, mixed>> */
    public static function etaTemplates(): array
    {
        return [
            [
                'slug'        => 'eta-traveler-details',
                'title'       => 'eTA — Traveler Details',
                'description' => 'Online eTA application details (no PDF form available on Canada.ca).',
                'sort_order'  => 1,
                'form_schema' => [
                    'fields' => [
                        ['type' => 'section', 'label' => 'Personal information'],
                        ['type' => 'text', 'key' => 'family_name', 'label' => 'Family name', 'required' => true],
                        ['type' => 'text', 'key' => 'given_names', 'label' => 'Given name(s)', 'required' => true],
                        ['type' => 'date', 'key' => 'date_of_birth', 'label' => 'Date of birth', 'required' => true],
                        ['type' => 'text', 'key' => 'birth_country', 'label' => 'Country of birth', 'required' => true],
                        ['type' => 'text', 'key' => 'citizenship', 'label' => 'Citizenship', 'required' => true],
                        ['type' => 'section', 'label' => 'Passport'],
                        ['type' => 'text', 'key' => 'passport_number', 'label' => 'Passport number', 'required' => true],
                        ['type' => 'date', 'key' => 'passport_expiry', 'label' => 'Passport expiry date', 'required' => true],
                        ['type' => 'section', 'label' => 'Travel'],
                        ['type' => 'date', 'key' => 'intended_travel_date', 'label' => 'Intended date of travel to Canada'],
                        ['type' => 'textarea', 'key' => 'travel_purpose', 'label' => 'Purpose of visit', 'required' => true],
                    ],
                ],
            ],
        ];
    }

    /** @return list<array<string, mixed>> */
    public static function genericOnlineTemplates(IrccCategory $package): array
    {
        $slug = 'online-application-details';

        return [
            [
                'slug'        => $slug,
                'title'       => $package->label . ' — Application Details',
                'description' => 'Online-only application data collection (no IRCC PDF available).',
                'sort_order'  => 1,
                'form_schema' => [
                    'fields' => [
                        ['type' => 'section', 'label' => 'Applicant'],
                        ['type' => 'text', 'key' => 'full_name', 'label' => 'Full legal name', 'required' => true],
                        ['type' => 'date', 'key' => 'date_of_birth', 'label' => 'Date of birth', 'required' => true],
                        ['type' => 'email', 'key' => 'email', 'label' => 'Email address', 'required' => true],
                        ['type' => 'tel', 'key' => 'phone', 'label' => 'Phone number', 'required' => true],
                        ['type' => 'textarea', 'key' => 'application_notes', 'label' => 'Additional application details'],
                    ],
                ],
            ],
        ];
    }
}
