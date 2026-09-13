<?php

namespace App\Console\Commands;

use App\Models\CaseFile;
use App\Models\CaseGovernmentRequest;
use App\Models\CaseHistoryEvent;
use App\Models\ConsultantSubscription;
use App\Models\QuestionnaireSubmission;
use App\Models\SubscriptionPackage;
use App\Models\User;
use App\Services\CaseActivationService;
use App\Services\CaseRepresentativeAuthorizationService;
use App\Services\CaseRequirementPlanService;
use App\Support\CaseWorkflowStatus;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class Phase5SeedSmokeCommand extends Command
{
    protected $signature = 'phase5:seed-smoke';

    protected $description = 'Create isolated consultant/clients for Phase 5 post-submission browser smoke';

    public function handle(
        CaseRequirementPlanService $plans,
        CaseRepresentativeAuthorizationService $representative,
        CaseActivationService $activation,
    ): int {
        $consultant = User::query()->updateOrCreate(
            ['email' => 'phase5.smoke@example.test'],
            [
                'name' => 'Phase5 Smoke RCIC',
                'password' => Hash::make('SmokeTest123!'),
                'is_verified' => true,
                'email_verified_at' => now(),
                'rcic_number' => 'R999000005',
                'is_license_verified' => true,
                'license_verified_at' => now(),
                'company_name' => 'Phase5 Smoke Firm',
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
                'starts_at' => now()->subDay(),
                'ends_at' => now()->addYear(),
                'billing_cycle' => 'monthly',
            ]
        );

        $presub = $this->activatedCase($plans, $representative, $activation, $consultant, 'presub', 'study', 'Study Permit', 15001);
        $this->resetPhase5($presub['case'], submitted: false);

        $main = $this->activatedCase($plans, $representative, $activation, $consultant, 'main', 'study', 'Study Permit', 15002);
        $this->resetPhase5($main['case'], submitted: true);

        $close = $this->activatedCase($plans, $representative, $activation, $consultant, 'close', 'study', 'Study Permit', 15003);
        $this->resetPhase5($close['case'], submitted: true);

        $refused = $this->activatedCase($plans, $representative, $activation, $consultant, 'refused', 'visitor', 'Visitor Visa (TRV)', 15004);
        $this->resetPhase5($refused['case'], submitted: true);

        $withdrawn = $this->activatedCase($plans, $representative, $activation, $consultant, 'withdrawn', 'study', 'Study Permit', 15005);
        $this->resetPhase5($withdrawn['case'], submitted: true);

        $other = $this->activatedCase($plans, $representative, $activation, $consultant, 'other', 'study', 'Study Permit', 15006);
        $this->resetPhase5($other['case'], submitted: true);

        $legacy = $this->activatedCase($plans, $representative, $activation, $consultant, 'legacy', 'study', 'Study Permit', 15007);
        $this->resetPhase5($legacy['case'], submitted: true, legacy: true);

        $payload = [
            'consultant_email' => $consultant->email,
            'password' => 'SmokeTest123!',
            'presub_profile_id' => $presub['profile']->id,
            'presub_case_id' => $presub['case']->id,
            'presub_client_email' => $presub['client']->email,
            'main_profile_id' => $main['profile']->id,
            'main_case_id' => $main['case']->id,
            'main_client_email' => $main['client']->email,
            'close_profile_id' => $close['profile']->id,
            'close_case_id' => $close['case']->id,
            'close_client_email' => $close['client']->email,
            'refused_profile_id' => $refused['profile']->id,
            'withdrawn_profile_id' => $withdrawn['profile']->id,
            'other_profile_id' => $other['profile']->id,
            'legacy_profile_id' => $legacy['profile']->id,
            'legacy_case_id' => $legacy['case']->id,
        ];
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        $path = base_path('../docs/plans/phase5-verification/smoke-fixture.json');
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0777, true);
        }
        file_put_contents($path, $json);
        $this->line($json);

        return self::SUCCESS;
    }

    /**
     * @return array{client: User, profile: \App\Models\ClientProfile, case: CaseFile}
     */
    private function activatedCase(
        CaseRequirementPlanService $plans,
        CaseRepresentativeAuthorizationService $representative,
        CaseActivationService $activation,
        User $consultant,
        string $slug,
        string $code,
        string $label,
        int $caseNumber,
    ): array {
        $client = User::query()->updateOrCreate(
            ['email' => "phase5.smoke.{$slug}@example.test"],
            [
                'name' => 'Phase5 '.$slug,
                'password' => Hash::make('SmokeTest123!'),
                'is_verified' => true,
                'email_verified_at' => now(),
            ]
        );
        $client->assignRole('client');
        $profile = \App\Models\ClientProfile::query()->firstOrCreate([
            'user_id' => $client->id,
            'consultant_id' => $consultant->id,
        ]);
        $case = CaseFile::query()->firstOrCreate(
            [
                'client_profile_id' => $profile->id,
                'consultant_id' => $consultant->id,
                'name' => 'Phase5 smoke '.$slug,
            ],
            [
                'case_number' => $caseNumber,
                'status' => 'PENDING_ASSESSMENT',
                'lifecycle_status' => 'active',
            ]
        );
        $case->update([
            'consultation_completed_at' => now(),
            'profile_reviewed_at' => now(),
            'immigration_pathway' => $label,
            'pathway_code' => $code,
            'pathway_selection_reason' => 'Phase 5 smoke pathway selection reason.',
            'status' => 'PATHWAY_SELECTED',
            'assigned_ircc_category_id' => null,
        ]);
        $profile->update(['active_case_file_id' => $case->id, 'immigration_pathway' => $label, 'pathway_code' => $code]);
        QuestionnaireSubmission::query()->updateOrCreate(
            ['user_id' => $client->id],
            [
                'main_data' => [
                    'passportFullName' => 'Phase5 '.$slug,
                    'dob' => '1991-04-04',
                    'passportNumber' => 'P5'.strtoupper($slug),
                    'educationLevels' => ['bachelors'],
                    'languageTest' => 'yes',
                    'workExperience' => '3_or_more',
                ],
                'is_submitted' => true,
                'submitted_at' => now(),
            ]
        );
        $plans->snapshotForPathway($case->fresh(), $consultant, 'assign', $code, $label, 'Phase 5 smoke');
        $representative->initializeFromPlan($case->fresh(), $consultant);
        $case->fresh()->update(['agreement_signed_at' => now(), 'status' => 'AGREEMENT_SIGNED']);
        $req = $case->fresh()->currentRequirementPlan?->snapshot['representative']['status'] ?? 'optional';
        if ($req === 'required') {
            $representative->complete($case->fresh(), $consultant);
        } elseif ($req === 'optional') {
            $representative->leaveUnused($case->fresh(), $consultant);
        } else {
            $activation->refresh($case->fresh(), $consultant);
        }

        return compact('client', 'profile', 'case');
    }

    private function resetPhase5(CaseFile $case, bool $submitted, bool $legacy = false): void
    {
        CaseGovernmentRequest::query()->where('case_file_id', $case->id)->delete();
        CaseHistoryEvent::query()
            ->where('case_file_id', $case->id)
            ->whereIn('event_type', [
                'government_request_created',
                'government_request_in_progress',
                'government_request_answered',
                'decision_recorded',
                'closure_checklist_saved',
                'case_closed',
                'application_submitted',
            ])
            ->delete();

        $case->fresh()->update([
            'decision_status' => null,
            'decision_at' => null,
            'decision_letter_path' => null,
            'decision_note' => null,
            'next_step_note' => null,
            'closure_checklist' => null,
            'closure_reviewed_at' => null,
            'closure_reviewed_by' => null,
            'lifecycle_status' => 'active',
            'status' => $submitted ? 'APPLICATION_SUBMITTED' : 'AGREEMENT_SIGNED',
            'workflow_status' => $submitted
                ? ($legacy ? null : CaseWorkflowStatus::SUBMITTED)
                : CaseWorkflowStatus::CASE_ACTIVE,
            'submitted_at' => $submitted ? now()->subDays($legacy ? 40 : 2) : null,
            'submission_date' => $submitted ? now()->subDays($legacy ? 40 : 2)->toDateString() : null,
            'application_number' => $submitted ? ($legacy ? 'LEGACY-P5-001' : 'P5-'.$case->id) : null,
            'confirmation_number' => $submitted ? ($legacy ? 'LEGACY-P5-CONF' : 'CONF-'.$case->id) : null,
        ]);

        if ($submitted) {
            CaseHistoryEvent::create([
                'case_file_id' => $case->id,
                'client_profile_id' => $case->client_profile_id,
                'actor_user_id' => $case->consultant_id,
                'event_type' => 'application_submitted',
                'title' => $legacy ? 'Legacy application submitted' : 'Application submitted',
                'payload' => ['legacy' => $legacy, 'auto_submitted' => false],
                'occurred_at' => now()->subDays($legacy ? 40 : 2),
            ]);
        }
    }
}
