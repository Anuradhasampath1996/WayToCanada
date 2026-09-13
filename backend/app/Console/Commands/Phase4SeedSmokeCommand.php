<?php

namespace App\Console\Commands;

use App\Models\CaseFile;
use App\Models\CaseHistoryEvent;
use App\Models\ConsultantSubscription;
use App\Models\DocumentSubmission;
use App\Models\QuestionnaireSubmission;
use App\Models\SubscriptionPackage;
use App\Models\User;
use App\Services\CaseActivationService;
use App\Services\CaseRepresentativeAuthorizationService;
use App\Services\CaseRequirementPlanService;
use App\Support\CaseWorkflowStatus;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class Phase4SeedSmokeCommand extends Command
{
    protected $signature = 'phase4:seed-smoke';

    protected $description = 'Create isolated consultant/clients for Phase 4 final-review browser smoke';

    public function handle(
        CaseRequirementPlanService $plans,
        CaseRepresentativeAuthorizationService $representative,
        CaseActivationService $activation,
    ): int {
        $consultant = User::query()->updateOrCreate(
            ['email' => 'phase4.smoke@example.test'],
            [
                'name' => 'Phase4 Smoke RCIC',
                'password' => Hash::make('SmokeTest123!'),
                'is_verified' => true,
                'email_verified_at' => now(),
                'rcic_number' => 'R999000004',
                'is_license_verified' => true,
                'license_verified_at' => now(),
                'company_name' => 'Phase4 Smoke Firm',
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

        $sig = $this->activatedCase($plans, $representative, $activation, $consultant, 'sig', 'study', 'Study Permit', 14001);
        $this->resetPhase4($sig['case']);

        $nosig = $this->activatedCase($plans, $representative, $activation, $consultant, 'nosig', 'visitor', 'Visitor Visa (TRV)', 14002);
        $this->resetPhase4($nosig['case']);
        $plan = $nosig['case']->fresh()->currentRequirementPlan;
        $snap = $plan->snapshot;
        $snap['client_signature_required'] = false;
        $plan->update(['snapshot' => $snap]);

        $docs = $this->activatedCase($plans, $representative, $activation, $consultant, 'docs', 'study', 'Study Permit', 14003);
        $this->resetPhase4($docs['case']);
        DocumentSubmission::query()->updateOrCreate(
            [
                'case_file_id' => $docs['case']->id,
                'document_type' => 'passport',
            ],
            [
                'uploaded_by' => $consultant->id,
                'document_label' => 'Passport',
                'file_path' => 'case-documents/phase4-passport.pdf',
                'original_filename' => 'passport.pdf',
                'mime_type' => 'application/pdf',
                'status' => 'pending_review',
            ]
        );

        $legacyReady = $this->activatedCase($plans, $representative, $activation, $consultant, 'legacyready', 'study', 'Study Permit', 14004);
        $this->resetPhase4($legacyReady['case']);
        $legacyReady['case']->fresh()->update([
            'status' => 'READY_FOR_SUBMISSION',
            'workflow_status' => CaseWorkflowStatus::READY_TO_SUBMIT,
        ]);

        $legacySubmitted = $this->activatedCase($plans, $representative, $activation, $consultant, 'legacysub', 'study', 'Study Permit', 14005);
        $this->resetPhase4($legacySubmitted['case']);
        $legacySubmitted['case']->fresh()->update([
            'status' => 'APPLICATION_SUBMITTED',
            'workflow_status' => CaseWorkflowStatus::SUBMITTED,
            'submitted_at' => now()->subDays(10),
            'submission_date' => now()->subDays(10)->toDateString(),
            'application_number' => 'LEGACY-APP-001',
            'confirmation_number' => 'LEGACY-CONF-001',
        ]);
        if (! CaseHistoryEvent::query()
            ->where('case_file_id', $legacySubmitted['case']->id)
            ->where('event_type', 'application_submitted')
            ->exists()) {
            CaseHistoryEvent::create([
                'case_file_id' => $legacySubmitted['case']->id,
                'client_profile_id' => $legacySubmitted['profile']->id,
                'actor_user_id' => $consultant->id,
                'event_type' => 'application_submitted',
                'title' => 'Legacy application submitted',
                'payload' => ['legacy' => true, 'auto_submitted' => false],
                'occurred_at' => now()->subDays(10),
            ]);
        }

        $payload = [
            'consultant_email' => $consultant->email,
            'password' => 'SmokeTest123!',
            'sig_profile_id' => $sig['profile']->id,
            'sig_case_id' => $sig['case']->id,
            'sig_client_email' => $sig['client']->email,
            'nosig_profile_id' => $nosig['profile']->id,
            'nosig_case_id' => $nosig['case']->id,
            'nosig_client_email' => $nosig['client']->email,
            'docs_profile_id' => $docs['profile']->id,
            'docs_case_id' => $docs['case']->id,
            'legacy_ready_profile_id' => $legacyReady['profile']->id,
            'legacy_ready_case_id' => $legacyReady['case']->id,
            'legacy_submitted_profile_id' => $legacySubmitted['profile']->id,
            'legacy_submitted_case_id' => $legacySubmitted['case']->id,
        ];
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        $path = base_path('../docs/plans/phase4-verification/smoke-fixture.json');
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
            ['email' => "phase4.smoke.{$slug}@example.test"],
            [
                'name' => 'Phase4 '.$slug,
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
                'name' => 'Phase4 smoke '.$slug,
            ],
            [
                'case_number' => $caseNumber,
                'status' => 'PENDING_ASSESSMENT',
                'lifecycle_status' => 'in_progress',
            ]
        );
        $case->update([
            'consultation_completed_at' => now(),
            'profile_reviewed_at' => now(),
            'immigration_pathway' => $label,
            'pathway_code' => $code,
            'pathway_selection_reason' => 'Phase 4 smoke pathway selection reason.',
            'status' => 'PATHWAY_SELECTED',
            'assigned_ircc_category_id' => null,
        ]);
        $profile->update(['active_case_file_id' => $case->id, 'immigration_pathway' => $label, 'pathway_code' => $code]);
        QuestionnaireSubmission::query()->updateOrCreate(
            ['user_id' => $client->id],
            [
                'main_data' => [
                    'passportFullName' => 'Phase4 '.$slug,
                    'dob' => '1992-03-03',
                    'passportNumber' => 'P4'.strtoupper($slug),
                    'educationLevels' => ['bachelors'],
                    'languageTest' => 'yes',
                    'workExperience' => '3_or_more',
                ],
                'is_submitted' => true,
                'submitted_at' => now(),
            ]
        );
        $plans->snapshotForPathway($case->fresh(), $consultant, 'assign', $code, $label, 'Phase 4 smoke');
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

    private function resetPhase4(CaseFile $case): void
    {
        $plan = $case->fresh()->currentRequirementPlan;
        if ($plan) {
            $snapshot = $plan->snapshot ?? [];
            $snapshot['portals'] = $snapshot['portals'] ?? [];
            $snapshot['portals']['confirmed'] = null;
            $snapshot['portals']['confirmed_at'] = null;
            $snapshot['portals']['confirmed_by'] = null;
            $plan->update(['snapshot' => $snapshot]);
        }

        $case->fresh()->update([
            'final_review_checklist' => null,
            'final_review_notes' => null,
            'ready_for_client_review_at' => null,
            'ready_for_client_review_by' => null,
            'client_acknowledged_at' => null,
            'client_acknowledgement_ip' => null,
            'client_acknowledgement_user_agent' => null,
            'client_declaration_signed_at' => null,
            'client_declaration_signature' => null,
            'ready_to_submit_at' => null,
            'submitted_at' => null,
            'submission_date' => null,
            'application_number' => null,
            'confirmation_number' => null,
            'government_fees' => null,
            'payment_confirmation' => null,
            'receipt_path' => null,
            'submitted_documents_snapshot' => null,
            'confirmed_submission_portal' => null,
            'status' => 'AGREEMENT_SIGNED',
            'workflow_status' => CaseWorkflowStatus::CASE_ACTIVE,
        ]);
    }
}
