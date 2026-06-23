<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\ClientTrustAccount;
use App\Models\DocumentSubmission;
use App\Models\QuestionnaireSubmission;

class ClientCommandCenterService
{
    public function __construct(
        private WorkspaceCaseRulesService $rules,
        private IrccInteractiveFormVerificationService $formsVerification,
    ) {}

    /** @return array<string, mixed> */
    public function build(ClientProfile $profile): array
    {
        $profile->loadMissing('user:id,name,email,phone');

        $caseFile = CaseFile::where('client_profile_id', $profile->id)->first();
        if ($caseFile) {
            $caseFile->syncStatusFromAgreement();
            $caseFile = $caseFile->fresh();
        }

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->first();

        $verification = $caseFile
            ? $this->formsVerification->getVerificationStatus($caseFile)
            : [
                'agreement_signed'         => false,
                'case_management_unlocked' => false,
                'total_forms'              => 0,
                'submitted_count'          => 0,
                'reviewed_count'           => 0,
                'all_submitted'            => false,
                'all_reviewed'             => false,
                'verified_at'              => null,
            ];

        $caseSummary = $this->rules->summarizeForClientList(
            $profile->id,
            $caseFile,
            $submission,
            $verification,
        );

        $qStats = $this->questionnaireStats($submission);

        $pipeline    = null;
        $statusOrder = CaseFile::statusOrder();
        if ($caseFile && ($statusOrder[$caseFile->status] ?? 0) >= ($statusOrder['AGREEMENT_SIGNED'] ?? 3)) {
            $pendingDocs = DocumentSubmission::query()
                ->where('case_file_id', $caseFile->id)
                ->whereIn('status', ['pending_review', 'under_ai_review', 'ai_flagged'])
                ->count();

            $pipeline = [
                'status'       => $caseFile->status,
                'status_label' => ConsultantClientListService::statusLabels()[$caseFile->status]
                    ?? str_replace('_', ' ', ucwords(strtolower($caseFile->status), '_')),
                'pending_docs' => $pendingDocs,
            ];
        }

        $trustAccount = ClientTrustAccount::where('client_profile_id', $profile->id)->first();
        $unlocked     = (bool) ($verification['case_management_unlocked'] ?? false);

        return [
            'case_file' => $caseFile ? [
                'id'                          => $caseFile->id,
                'status'                      => $caseFile->status,
                'immigration_pathway'         => $caseFile->immigration_pathway ?? $profile->immigration_pathway,
                'agreement_sent_at'           => $caseFile->agreement_sent_at?->toIso8601String(),
                'agreement_signed_at'         => $caseFile->agreement_signed_at?->toIso8601String(),
                'pathway_assessment_crs_score'=> $caseFile->pathway_assessment_crs_score,
                'pathway_assessment_at'       => $caseFile->pathway_assessment_at?->toIso8601String(),
            ] : null,
            'case_summary'  => $caseSummary,
            'questionnaire' => $qStats,
            'verification'  => $verification,
            'pipeline'      => $pipeline,
            'workflow'      => [
                'active_step'              => $this->activeWorkflowStep($caseFile, $unlocked),
                'case_management_unlocked' => $unlocked,
            ],
            'trust' => $trustAccount ? [
                'balance_held' => (float) $trustAccount->balance_held,
                'currency'     => $trustAccount->currency ?? 'CAD',
            ] : null,
        ];
    }

    private function activeWorkflowStep(?CaseFile $caseFile, bool $caseManagementUnlocked): int
    {
        if ($caseManagementUnlocked) {
            return 3;
        }
        if ($caseFile?->agreement_signed_at) {
            return 2;
        }
        if ($caseFile?->immigration_pathway) {
            return 1;
        }

        return 0;
    }

    /** @return array<string, mixed> */
    private function questionnaireStats(?QuestionnaireSubmission $submission): array
    {
        if (! $submission) {
            return [
                'has_submission'   => false,
                'is_submitted'     => false,
                'submitted_at'     => null,
                'verified_count'   => 0,
                'pending_refills'  => 0,
                'has_main_profile' => false,
            ];
        }

        $remarks = $submission->field_remarks ?? [];
        $pending = collect($remarks)->filter(fn ($r) => ($r['status'] ?? '') === 'pending')->count();

        return [
            'has_submission'   => true,
            'is_submitted'     => (bool) $submission->is_submitted,
            'submitted_at'     => $submission->submitted_at?->toIso8601String(),
            'verified_count'   => count($submission->verified_fields ?? []),
            'pending_refills'  => $pending,
            'has_main_profile' => ! empty($submission->main_data),
        ];
    }
}
