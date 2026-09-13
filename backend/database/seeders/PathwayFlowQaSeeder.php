<?php

namespace Database\Seeders;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use App\Services\CaseFileLifecycleService;
use App\Services\IrccPackageSuggestionService;
use App\Services\PathwayCatalogService;
use App\Support\IrccFamilySponsorshipPackages;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * One QA client per immigration pathway for end-to-end flow testing.
 * Emails: qa.pathway.{slug}@waytocanada.test  password: QaPathway123!
 */
class PathwayFlowQaSeeder extends Seeder
{
    public const CONSULTANT_EMAIL = 'anuradhasampath666@gmail.com';

    public const PASSWORD = 'QaPathway123!';

    /** @var list<array{pathway: string, pathway_code: string, email: string, name: string, stage: string}> */
    public const CLIENTS = [
        [
            'pathway' => 'Express Entry – Federal Skilled Worker',
            'pathway_code' => 'ee.fsw',
            'email' => 'qa.pathway.ee-fsw@waytocanada.test',
            'name' => 'QA EE FSW Client',
            'stage' => 'pathway_package',
        ],
        [
            'pathway' => 'Express Entry – Canadian Experience Class',
            'pathway_code' => 'ee.cec',
            'email' => 'qa.pathway.ee-cec@waytocanada.test',
            'name' => 'QA EE CEC Client',
            'stage' => 'pathway_package',
        ],
        [
            'pathway' => 'Express Entry – Federal Skilled Trades',
            'pathway_code' => 'ee.fst',
            'email' => 'qa.pathway.ee-fst@waytocanada.test',
            'name' => 'QA EE FST Client',
            'stage' => 'pathway_package',
        ],
        [
            'pathway' => 'Provincial Nominee Program',
            'pathway_code' => 'pnp',
            'email' => 'qa.pathway.pnp@waytocanada.test',
            'name' => 'QA PNP Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'Ontario OINP',
            'pathway_code' => 'pnp.on',
            'email' => 'qa.pathway.pnp-on@waytocanada.test',
            'name' => 'QA Ontario OINP Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'Study Permit',
            'pathway_code' => 'study',
            'email' => 'qa.pathway.study@waytocanada.test',
            'name' => 'QA Study Permit Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'Work Permit',
            'pathway_code' => 'work',
            'email' => 'qa.pathway.work@waytocanada.test',
            'name' => 'QA Work Permit Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'Family Sponsorship – Spouse / Common-law Partner',
            'pathway_code' => 'family.spouse',
            'email' => 'qa.pathway.family@waytocanada.test',
            'name' => 'QA Family Spouse Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'Family Sponsorship – Parents and Grandparents',
            'pathway_code' => 'family.pgp',
            'email' => 'qa.pathway.family-pgp@waytocanada.test',
            'name' => 'QA Family PGP Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'RCIP → Thunder Bay',
            'pathway_code' => 'pilot.rcip.thunder-bay',
            'email' => 'qa.pathway.rcip-thunder-bay@waytocanada.test',
            'name' => 'QA RCIP Thunder Bay Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'FCIP → Sudbury',
            'pathway_code' => 'pilot.fcip.sudbury',
            'email' => 'qa.pathway.fcip-sudbury@waytocanada.test',
            'name' => 'QA FCIP Sudbury Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'AIP – Nova Scotia',
            'pathway_code' => 'pilot.aip.ns',
            'email' => 'qa.pathway.aip-ns@waytocanada.test',
            'name' => 'QA AIP Nova Scotia Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'Quebec – Skilled Worker (PSTQ / Arrima)',
            'pathway_code' => 'quebec.pstq',
            'email' => 'qa.pathway.quebec-pstq@waytocanada.test',
            'name' => 'QA Quebec PSTQ Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'Start-up Visa',
            'pathway_code' => 'business.startup',
            'email' => 'qa.pathway.business-startup@waytocanada.test',
            'name' => 'QA Start-up Visa Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'OINP – Employer Job Offer',
            'pathway_code' => 'pnp.on.employer-job-offer',
            'email' => 'qa.pathway.oinp-job-offer@waytocanada.test',
            'name' => 'QA OINP Job Offer Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'Visitor Visa (TRV)',
            'pathway_code' => 'visitor',
            'email' => 'qa.pathway.visitor@waytocanada.test',
            'name' => 'QA Visitor Visa Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'Super Visa (Parents and Grandparents)',
            'pathway_code' => 'visitor.super',
            'email' => 'qa.pathway.super-visa@waytocanada.test',
            'name' => 'QA Super Visa Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'Canadian Citizenship (Grant)',
            'pathway_code' => 'citizenship',
            'email' => 'qa.pathway.citizenship@waytocanada.test',
            'name' => 'QA Citizenship Client',
            'stage' => 'signed_unlocked',
        ],
        [
            'pathway' => 'PR Card Renew / Replace',
            'pathway_code' => 'pr_card',
            'email' => 'qa.pathway.pr-card@waytocanada.test',
            'name' => 'QA PR Card Client',
            'stage' => 'signed_unlocked',
        ],
    ];

    public function run(): void
    {
        IrccFamilySponsorshipPackages::ensure();
        $this->call(PathwayCatalogSeeder::class);

        $consultant = User::where('email', self::CONSULTANT_EMAIL)->first();
        if (! $consultant) {
            $this->command?->error('Consultant '.self::CONSULTANT_EMAIL.' not found.');

            return;
        }

        $lifecycle = app(CaseFileLifecycleService::class);
        $packages = app(IrccPackageSuggestionService::class);
        $catalog = app(PathwayCatalogService::class);

        foreach (self::CLIENTS as $spec) {
            $resolved = $catalog->resolve($spec['pathway_code'] ?? null, $spec['pathway']);
            $pathwayLabel = $resolved['label'] ?? $spec['pathway'];
            $pathwayCode = $resolved['code'] ?? ($spec['pathway_code'] ?? null);

            $user = User::updateOrCreate(
                ['email' => $spec['email']],
                [
                    'name' => $spec['name'],
                    'phone' => '+1 416 555 '.str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT),
                    'password' => Hash::make(self::PASSWORD),
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
                    'immigration_pathway' => $pathwayLabel,
                    'pathway_code' => $pathwayCode,
                    'notes' => 'QA pathway flow seed — '.$pathwayLabel,
                    'invited_at' => now(),
                ]
            );

            $case = $lifecycle->resolveActiveCaseFile($profile, $consultant->id, createIfMissing: true);
            if (! $case) {
                $this->command?->error("Failed to create case for {$spec['email']}");
                continue;
            }

            $this->seedQuestionnaire($user, array_merge($spec, ['pathway' => $pathwayLabel]));

            $case->update([
                'immigration_pathway' => $pathwayLabel,
                'pathway_code' => $pathwayCode,
                'status' => 'PATHWAY_SELECTED',
                'agreement_token' => null,
                'agreement_sent_at' => null,
                'agreement_signed_at' => null,
                'application_forms_verified_at' => null,
                'assigned_ircc_category_id' => null,
                'application_package_assigned_at' => null,
            ]);

            $auto = $packages->autoAssignForPathway($case->fresh(), $pathwayLabel);
            $case = $case->fresh();

            if ($spec['stage'] === 'signed_unlocked') {
                $case->update([
                    'agreement_token' => (string) Str::uuid(),
                    'agreement_sent_at' => now()->subDay(),
                    'agreement_signed_at' => now()->subHours(2),
                    'status' => 'AGREEMENT_SIGNED',
                ]);
                app(\App\Services\IrccInteractiveFormVerificationService::class)
                    ->getVerificationStatus($case->fresh());
            }

            $label = $case->fresh()->assignedIrccCategory?->label ?? 'NONE';
            $this->command?->info(sprintf(
                '[%s] %s (%s) → package: %s (assigned=%s)',
                $auto['assigned'] ? 'OK' : 'WARN',
                $pathwayLabel,
                $pathwayCode ?? 'no-code',
                $label,
                $auto['assigned'] ? 'yes' : 'no'
            ));
        }

        $this->command?->info('Pathway QA clients ready. Password: '.self::PASSWORD);
    }

    /** @param  array{pathway: string, email: string, name: string, stage: string}  $spec */
    private function seedQuestionnaire(User $user, array $spec): void
    {
        $slug = Str::slug(Str::before($spec['email'], '@'));
        $name = $spec['name'];

        QuestionnaireSubmission::updateOrCreate(
            ['user_id' => $user->id],
            [
                'step1_data' => [
                    'fullName' => $name,
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
                    'fullName' => $name,
                    'passportFullName' => $name,
                    'dob' => '1990-04-12',
                    'passportNumber' => 'QA'.strtoupper(substr(md5($spec['email']), 0, 7)),
                    'passportIssueDate' => '2019-06-01',
                    'passportExpiry' => '2029-06-01',
                    'passportNationality' => 'Sri Lankan',
                    'passportGender' => 'Male',
                    'birthCountry' => 'Sri Lanka',
                    'addressLine1' => '100 Queen Street West',
                    'city' => 'Toronto',
                    'countryOfResidence' => str_contains($spec['pathway'], 'Canadian Experience')
                        ? 'Canada'
                        : 'Sri Lanka',
                    'languageTest' => 'yes',
                    'languageTestType' => 'ielts',
                    'scores' => ['listening' => '8.0', 'reading' => '7.5', 'writing' => '7.0', 'speaking' => '7.5'],
                    'intendedNocCode' => '21231',
                    'intendedNocTitle' => 'Software engineers and designers',
                    'settlementFunds' => '25000',
                    'workExperience' => '3_or_more',
                    'studiedInCanada' => str_contains($spec['pathway'], 'Study') || str_contains($spec['pathway'], 'Canadian Experience')
                        ? 'yes'
                        : 'no',
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
    }
}
