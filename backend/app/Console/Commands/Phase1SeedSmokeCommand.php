<?php

namespace App\Console\Commands;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\ConsultantSubscription;
use App\Models\QuestionnaireSubmission;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class Phase1SeedSmokeCommand extends Command
{
    protected $signature = 'phase1:seed-smoke';

    protected $description = 'Create an isolated consultant + two clients for Phase 1 browser smoke';

    public function handle(): int
    {
        $consultant = User::query()->updateOrCreate(
            ['email' => 'phase1.smoke@example.test'],
            [
                'name' => 'Phase1 Smoke RCIC',
                'password' => Hash::make('SmokeTest123!'),
                'is_verified' => true,
                'email_verified_at' => now(),
                'rcic_number' => 'R999000001',
                'is_license_verified' => true,
                'license_verified_at' => now(),
                'company_name' => 'Phase1 Smoke Firm',
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

        $incomplete = $this->makeClient($consultant, 'incomplete', [
            'passportFullName' => 'Smoke Incomplete',
            'dob' => '1992-02-02',
        ]);

        $complete = $this->makeClient($consultant, 'complete', [
            'passportFullName' => 'Smoke Complete Client',
            'dob' => '1990-01-15',
            'passportNumber' => 'N7654321',
            'educationLevels' => ['bachelors'],
            'languageTest' => 'yes',
            'workExperience' => '3_or_more',
            'studiedInCanada' => 'no',
        ]);

        $payload = [
            'consultant_email' => $consultant->email,
            'password' => 'SmokeTest123!',
            'incomplete_profile_id' => $incomplete['profile']->id,
            'complete_profile_id' => $complete['profile']->id,
            'incomplete_case_id' => $incomplete['case']->id,
            'complete_case_id' => $complete['case']->id,
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
            ['email' => "phase1.smoke.{$slug}@example.test"],
            [
                'name' => 'Phase1 Smoke '.ucfirst($slug),
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
                'name' => 'Phase1 smoke '.$slug,
            ],
            [
                'case_number' => $slug === 'complete' ? 31001 : 31002,
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
            'status' => 'PENDING_ASSESSMENT',
            'workflow_status' => null,
        ]);

        $profile->update(['active_case_file_id' => $case->id]);

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
