<?php

namespace App\Console\Commands;

use App\Models\CaseFile;
use App\Models\CaseRequirementPlan;
use App\Models\ClientProfile;
use App\Models\ConsultantSubscription;
use App\Models\QuestionnaireSubmission;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class Phase2SeedSmokeCommand extends Command
{
    protected $signature = 'phase2:seed-smoke';

    protected $description = 'Create isolated consultant + Study/EE clients for Phase 2 auto-assign browser smoke';

    public function handle(): int
    {
        $consultant = User::query()->updateOrCreate(
            ['email' => 'phase2.smoke@example.test'],
            [
                'name' => 'Phase2 Smoke RCIC',
                'password' => Hash::make('SmokeTest123!'),
                'is_verified' => true,
                'email_verified_at' => now(),
                'rcic_number' => 'R999000002',
                'is_license_verified' => true,
                'license_verified_at' => now(),
                'company_name' => 'Phase2 Smoke Firm',
            ]
        );
        $consultant->assignRole('rcic');

        $package = SubscriptionPackage::query()->where('is_active', true)->orderBy('sort_order')->first()
            ?? SubscriptionPackage::query()->first();

        ConsultantSubscription::query()->updateOrCreate(
            ['user_id' => $consultant->id],
            [
                'subscription_package_id' => $package?->id,
                'status' => 'active',
                'is_trial' => false,
                'starts_at' => now()->subDay(),
                'ends_at' => now()->addYear(),
                'billing_cycle' => 'monthly',
                'cancelled_at' => null,
            ]
        );

        $study = $this->makeClient($consultant, 'study', [
            'passportFullName' => 'Phase2 Study Client',
            'dob' => '1994-04-04',
            'passportNumber' => 'S9988776',
            'educationLevels' => ['bachelors'],
            'languageTest' => 'yes',
            'workExperience' => '1_or_2',
            'studiedInCanada' => 'no',
            'canadaStudyProgram' => 'Computer Science',
            'canadaStudyStart' => '2026-09-01',
            'passportName' => 'client-document/2026/09/passport-study.pdf',
            'languageTestDocName' => 'client-document/2026/09/ielts-study.pdf',
            'educationQuals' => [
                ['documentName' => 'client-document/2026/09/transcript-study.pdf', 'courseName' => 'BSc'],
            ],
        ]);

        $ee = $this->makeClient($consultant, 'ee', [
            'passportFullName' => 'Phase2 EE Client',
            'dob' => '1991-06-06',
            'passportNumber' => 'E1122334',
            'educationLevels' => ['masters'],
            'languageTest' => 'yes',
            'workExperience' => '3_or_more',
            'canadianWork' => 'yes',
            'intendedNocCode' => '21231',
            'countryOfResidence' => 'Canada',
            'passportName' => 'client-document/2026/09/passport-ee.pdf',
            'languageTestDocName' => 'client-document/2026/09/ielts-ee.pdf',
            'educationQuals' => [
                ['documentName' => 'client-document/2026/09/transcript-ee.pdf', 'courseName' => 'MSc'],
            ],
        ]);

        $payload = [
            'consultant_email' => $consultant->email,
            'password' => 'SmokeTest123!',
            'study_profile_id' => $study['profile']->id,
            'ee_profile_id' => $ee['profile']->id,
            'study_case_id' => $study['case']->id,
            'ee_case_id' => $ee['case']->id,
        ];

        $this->line(json_encode($payload, JSON_PRETTY_PRINT));

        return self::SUCCESS;
    }

    /**
     * @param  array<string, mixed>  $main
     * @return array{client: User, profile: ClientProfile, case: CaseFile}
     */
    private function makeClient(User $consultant, string $slug, array $main): array
    {
        $client = User::query()->updateOrCreate(
            ['email' => "phase2.smoke.{$slug}@example.test"],
            [
                'name' => 'Phase2 Smoke '.strtoupper($slug),
                'password' => Hash::make('SmokeTest123!'),
                'is_verified' => true,
                'email_verified_at' => now(),
            ]
        );
        $client->assignRole('client');

        $profile = ClientProfile::query()->firstOrCreate(
            [
                'user_id' => $client->id,
                'consultant_id' => $consultant->id,
            ],
            []
        );

        $case = CaseFile::query()->firstOrCreate(
            [
                'client_profile_id' => $profile->id,
                'consultant_id' => $consultant->id,
                'name' => 'Phase2 smoke '.$slug,
            ],
            [
                'case_number' => $slug === 'study' ? 32001 : 32002,
                'status' => 'PENDING_ASSESSMENT',
                'lifecycle_status' => 'in_progress',
            ]
        );

        $case->update([
            'immigration_pathway' => null,
            'pathway_code' => null,
            'current_requirement_plan_id' => null,
            'consultation_completed_at' => null,
            'consultation_skipped_at' => null,
            'consultation_skip_reason' => null,
            'consultation_notes' => null,
            'profile_reviewed_at' => null,
            'pathway_selection_reason' => null,
            'pathway_alternatives' => null,
            'pathway_risks' => null,
            'maple_recommendation' => null,
            'maple_recommended_at' => null,
            'confirmed_submission_portal' => null,
            'assigned_ircc_category_id' => null,
            'application_package_assigned_at' => null,
            'status' => 'PENDING_ASSESSMENT',
            'workflow_status' => null,
        ]);
        CaseRequirementPlan::query()->where('case_file_id', $case->id)->delete();

        $profile->update([
            'active_case_file_id' => $case->id,
            'immigration_pathway' => null,
            'pathway_code' => null,
        ]);

        QuestionnaireSubmission::query()->updateOrCreate(
            ['user_id' => $client->id],
            [
                'main_data' => $main,
                'step1_data' => ['email' => $client->email, 'fullName' => $main['passportFullName'] ?? $client->name],
                'is_submitted' => true,
                'submitted_at' => now(),
            ]
        );

        return compact('client', 'profile', 'case');
    }
}
