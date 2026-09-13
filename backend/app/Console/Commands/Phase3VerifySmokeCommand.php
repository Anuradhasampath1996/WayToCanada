<?php

namespace App\Console\Commands;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\ConsultantSubscription;
use App\Models\DocumentSubmission;
use App\Models\QuestionnaireSubmission;
use App\Models\SubscriptionPackage;
use App\Models\User;
use App\Services\CaseActivationService;
use App\Services\CaseRepresentativeAuthorizationService;
use App\Services\CaseRequirementPlanService;
use App\Support\CaseWorkflowStatus;
use App\Support\DocumentWorkflowStatus;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class Phase3VerifySmokeCommand extends Command
{
    protected $signature = 'phase3:verify-smoke';

    protected $description = 'Phase 3 activation, representative, document, and board smoke checks';

    public function handle(
        CaseActivationService $activation,
        CaseRepresentativeAuthorizationService $representative,
        CaseRequirementPlanService $plans,
    ): int {
        $results = [];
        $record = function (string $id, bool $ok, string $detail) use (&$results) {
            $results[] = compact('id', 'ok', 'detail');
            $this->line(($ok ? 'PASS' : 'FAIL')." {$id} — {$detail}");
        };

        $consultant = $this->consultant();
        $required = $this->makeReadyCase($consultant, 'required');
        $optional = $this->makeReadyCase($consultant, 'optional');
        $na = $this->makeReadyCase($consultant, 'na');

        $this->selectPathway($plans, $representative, $consultant, $required['case'], 'study', 'Study Permit');
        $this->selectPathway($plans, $representative, $consultant, $optional['case'], 'visitor', 'Visitor Visa (TRV)');
        $this->selectPathway($plans, $representative, $consultant, $na['case'], 'study', 'Study Permit');

        $naPlan = $na['case']->fresh()->currentRequirementPlan;
        $snap = $naPlan->snapshot;
        $snap['representative']['status'] = 'not_applicable';
        $snap['representative']['bypass_allowed'] = true;
        $naPlan->update(['snapshot' => $snap]);
        $representative->initializeFromPlan($na['case']->fresh(), $consultant);

        $requiredCase = $required['case']->fresh();
        $requiredCase->update(['agreement_signed_at' => now(), 'status' => 'AGREEMENT_SIGNED']);
        $activation->refresh($requiredCase->fresh(), $consultant);
        $requiredCase = $requiredCase->fresh();
        $record(
            'inactive.required_incomplete',
            $requiredCase->case_activated_at === null
                && $requiredCase->representative_state !== 'completed',
            $requiredCase->case_activated_at
                ? 'Required case activated too early'
                : 'Retainer signed + required IMM5476 incomplete stays inactive',
        );

        $representative->complete($requiredCase, $consultant);
        $requiredCase = $requiredCase->fresh();
        $record(
            'activate.required_completed',
            $requiredCase->case_activated_at !== null
                && $requiredCase->representative_state === 'completed',
            $requiredCase->case_activated_at
                ? 'Required IMM5476 completed activated the case'
                : 'Case did not activate after required 5476 completed',
        );

        $optionalCase = $optional['case']->fresh();
        $optionalCase->update(['agreement_signed_at' => now(), 'status' => 'AGREEMENT_SIGNED']);
        $representative->leaveUnused($optionalCase, $consultant);
        $optionalCase = $optionalCase->fresh();
        $record(
            'activate.optional_unused',
            $optionalCase->case_activated_at !== null
                && $optionalCase->representative_state === 'unused',
            $optionalCase->case_activated_at
                ? 'Optional unused representative allowed activation'
                : 'Optional unused did not activate',
        );

        $naState = $representative->serialize($na['case']->fresh());
        $na['case']->fresh()->update(['agreement_signed_at' => now(), 'status' => 'AGREEMENT_SIGNED']);
        $activation->refresh($na['case']->fresh(), $consultant);
        $naCase = $na['case']->fresh();
        $record(
            'na.hidden_and_activates',
            $naState['visible'] === false
                && $naState['requirement'] === 'not_applicable'
                && $naCase->case_activated_at !== null,
            $naState['visible']
                ? 'N/A panel still visible'
                : 'N/A stage hidden/skipped and activation allowed',
        );

        $doc = DocumentSubmission::create([
            'case_file_id' => $requiredCase->id,
            'uploaded_by' => $consultant->id,
            'document_type' => 'passport',
            'document_label' => 'Passport',
            'file_path' => 'case-documents/phase3-passport.pdf',
            'original_filename' => 'passport.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'pending_review',
        ]);
        $doc->update(['status' => 'consultant_rejected', 'rejection_comment' => 'Clearer bio page needed.']);
        $correction = DocumentWorkflowStatus::canonicalize($doc->fresh()->status);
        $doc->update(['status' => 'resubmission_requested']);
        $resub = DocumentWorkflowStatus::canonicalize($doc->fresh()->status);
        $doc->update(['status' => 'consultant_approved']);
        $verified = DocumentWorkflowStatus::canonicalize($doc->fresh()->status);
        $record(
            'docs.correction_to_verified',
            $correction === DocumentWorkflowStatus::CORRECTION_REQUIRED
                && $resub === DocumentWorkflowStatus::RESUBMISSION_REQUESTED
                && $verified === DocumentWorkflowStatus::VERIFIED,
            'correction → resubmission → verified',
        );

        $legacyApprove = DocumentSubmission::create([
            'case_file_id' => $requiredCase->id,
            'uploaded_by' => $consultant->id,
            'document_type' => 'photos',
            'document_label' => 'Photos',
            'file_path' => 'case-documents/phase3-photos.pdf',
            'original_filename' => 'photos.pdf',
            'status' => 'pending_review',
        ]);
        $legacyReject = DocumentSubmission::create([
            'case_file_id' => $requiredCase->id,
            'uploaded_by' => $consultant->id,
            'document_type' => 'proof_address',
            'document_label' => 'Address',
            'file_path' => 'case-documents/phase3-address.pdf',
            'original_filename' => 'address.pdf',
            'status' => 'pending_review',
        ]);
        $legacyApprove->update(['status' => 'consultant_approved']);
        $legacyReject->update(['status' => 'consultant_rejected', 'rejection_comment' => 'Wrong document.']);
        $record(
            'docs.legacy_approve_reject',
            DocumentWorkflowStatus::canonicalize($legacyApprove->fresh()->status) === DocumentWorkflowStatus::VERIFIED
                && DocumentWorkflowStatus::canonicalize($legacyReject->fresh()->status) === DocumentWorkflowStatus::CORRECTION_REQUIRED
                && $legacyApprove->fresh()->status === 'consultant_approved'
                && $legacyReject->fresh()->status === 'consultant_rejected',
            'Legacy approve/reject still store and map to verified/correction_required',
        );

        $profiles = ClientProfile::query()
            ->where('consultant_id', $consultant->id)
            ->with(['caseFile:id,client_profile_id,status,workflow_status'])
            ->get();
        $pipeline = [];
        $groups = [
            CaseWorkflowStatus::GROUP_PRE_ENGAGEMENT => [],
            CaseWorkflowStatus::GROUP_ACTIVE_CASE => [],
            CaseWorkflowStatus::GROUP_POST_SUBMISSION => [],
        ];
        foreach ($profiles as $profile) {
            $cf = $profile->caseFile;
            if (! $cf) {
                continue;
            }
            $workflow = CaseWorkflowStatus::serialize($cf->workflow_status, $cf->status);
            $entry = [
                'case_file_id' => $cf->id,
                'workflow_status' => $workflow['status'],
                'group' => $workflow['group'],
            ];
            $pipeline[] = $entry;
            $groups[$workflow['group']][] = $entry;
        }
        $pipelineIds = array_column($pipeline, 'case_file_id');
        $groupIds = [];
        foreach ($groups as $cases) {
            foreach ($cases as $entry) {
                $groupIds[] = $entry['case_file_id'];
            }
        }
        $uniquePipeline = count(array_unique($pipelineIds));
        $uniqueGroups = count(array_unique($groupIds));
        $activeFilter = array_values(array_filter(
            $pipeline,
            fn ($entry) => $entry['workflow_status'] === CaseWorkflowStatus::CASE_ACTIVE,
        ));
        $activeStillInGroups = collect($activeFilter)->every(
            fn ($entry) => in_array($entry['case_file_id'], $groupIds, true),
        );
        $record(
            'board.groups_no_dup_or_loss',
            count($groups) === 3
                && $uniquePipeline === count($pipelineIds)
                && $uniqueGroups === count($groupIds)
                && $uniquePipeline === $uniqueGroups
                && $activeStillInGroups
                && $activeFilter !== []
                && in_array($requiredCase->id, $pipelineIds, true)
                && in_array($optionalCase->id, $pipelineIds, true)
                && in_array($naCase->id, $pipelineIds, true),
            'groups=3 pipeline='.$uniquePipeline.' grouped='.$uniqueGroups.' status_filter='.count($activeFilter),
        );

        $passed = count(array_filter($results, fn ($r) => $r['ok']));
        $failed = count($results) - $passed;
        $md = "# Phase 3 Representative / Activation — smoke\n\n"
            .'Date: '.now()->toIso8601String()."\n"
            .'Result: '.($failed === 0 ? 'PASS' : 'FAIL')." ({$passed} passed, {$failed} failed)\n\n"
            ."| Check | Result | Detail |\n|-------|--------|--------|\n"
            .implode("\n", array_map(fn ($r) => '| '.$r['id'].' | '.($r['ok'] ? 'PASS' : 'FAIL').' | '.$r['detail'].' |', $results))
            ."\n";
        $path = base_path('../docs/plans/phase3-verification/SMOKE.md');
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0777, true);
        }
        file_put_contents($path, $md);
        $this->newLine();
        $this->line('SMOKE '.($failed === 0 ? 'PASS' : 'FAIL')." {$passed}/".count($results));

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function consultant(): User
    {
        $consultant = User::query()->updateOrCreate(
            ['email' => 'phase3.smoke@example.test'],
            [
                'name' => 'Phase3 Smoke RCIC',
                'password' => Hash::make('SmokeTest123!'),
                'is_verified' => true,
                'email_verified_at' => now(),
                'rcic_number' => 'R999000003',
                'is_license_verified' => true,
                'license_verified_at' => now(),
                'company_name' => 'Phase3 Smoke Firm',
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

        return $consultant;
    }

    /**
     * @return array{profile: ClientProfile, case: CaseFile}
     */
    private function makeReadyCase(User $consultant, string $slug): array
    {
        $client = User::query()->updateOrCreate(
            ['email' => "phase3.smoke.{$slug}@example.test"],
            [
                'name' => 'Phase3 '.$slug,
                'password' => Hash::make('SmokeTest123!'),
                'is_verified' => true,
                'email_verified_at' => now(),
            ]
        );
        $client->assignRole('client');
        $profile = ClientProfile::query()->firstOrCreate([
            'user_id' => $client->id,
            'consultant_id' => $consultant->id,
        ]);
        $case = CaseFile::query()->firstOrCreate(
            [
                'client_profile_id' => $profile->id,
                'consultant_id' => $consultant->id,
                'name' => 'Phase3 smoke '.$slug,
            ],
            [
                'case_number' => 31000 + (abs(crc32($slug)) % 200),
                'status' => 'PENDING_ASSESSMENT',
                'lifecycle_status' => 'in_progress',
            ]
        );
        $case->update([
            'immigration_pathway' => null,
            'pathway_code' => null,
            'current_requirement_plan_id' => null,
            'consultation_completed_at' => now(),
            'profile_reviewed_at' => now(),
            'representative_state' => null,
            'representative_completed_at' => null,
            'case_activated_at' => null,
            'agreement_signed_at' => null,
            'status' => 'PENDING_ASSESSMENT',
            'workflow_status' => CaseWorkflowStatus::ELIGIBILITY_ASSESSMENT,
        ]);
        $profile->update(['active_case_file_id' => $case->id]);
        QuestionnaireSubmission::query()->updateOrCreate(
            ['user_id' => $client->id],
            [
                'main_data' => [
                    'passportFullName' => 'Phase3 '.$slug,
                    'dob' => '1990-01-15',
                    'passportNumber' => 'P3'.strtoupper($slug),
                    'educationLevels' => ['bachelors'],
                    'languageTest' => 'yes',
                    'workExperience' => '3_or_more',
                ],
                'is_submitted' => true,
                'submitted_at' => now(),
            ]
        );

        return compact('profile', 'case');
    }

    private function selectPathway(
        CaseRequirementPlanService $plans,
        CaseRepresentativeAuthorizationService $representative,
        User $consultant,
        CaseFile $case,
        string $code,
        string $label,
    ): void {
        $case->update([
            'immigration_pathway' => $label,
            'pathway_code' => $code,
            'pathway_selection_reason' => 'Phase 3 smoke pathway selection reason.',
            'status' => 'PATHWAY_SELECTED',
        ]);
        $plans->snapshotForPathway(
            $case->fresh(),
            $consultant,
            'assign',
            $code,
            $label,
            'Phase 3 smoke',
        );
        $representative->initializeFromPlan($case->fresh(), $consultant);
    }
}
