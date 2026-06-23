<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\DocumentSubmission;
use App\Models\QuestionnaireSubmission;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;

class ConsultantClientListService
{
    public function __construct(
        private WorkspaceCaseRulesService $rules,
        private IrccInteractiveFormVerificationService $formsVerification,
    ) {}

    /** @return array<string, string> */
    public static function statusLabels(): array
    {
        return [
            'PENDING_ASSESSMENT'    => 'Pending Assessment',
            'PATHWAY_SELECTED'      => 'Pathway Selected',
            'AGREEMENT_SENT'        => 'Agreement Sent',
            'AGREEMENT_SIGNED'      => 'Agreement Signed',
            'DOCUMENTS_UPLOADING'   => 'Documents Uploading',
            'UNDER_REVIEW'          => 'Under Review',
            'READY_FOR_SUBMISSION'  => 'Ready for Submission',
            'APPLICATION_SUBMITTED' => 'Application Submitted',
        ];
    }

    public function transformPaginated(LengthAwarePaginator $paginator): LengthAwarePaginator
    {
        /** @var \Illuminate\Support\Collection<int, ClientProfile> $profiles */
        $profiles = collect($paginator->items());

        if ($profiles->isEmpty()) {
            return $paginator;
        }

        $profileIds = $profiles->pluck('id');
        $userIds    = $profiles->pluck('user_id')->filter();

        $caseFiles = CaseFile::query()
            ->whereIn('client_profile_id', $profileIds)
            ->get()
            ->keyBy('client_profile_id');

        $pendingByCaseFile = DocumentSubmission::query()
            ->whereIn('case_file_id', $caseFiles->pluck('id')->filter())
            ->whereIn('status', ['pending_review', 'under_ai_review', 'ai_flagged'])
            ->groupBy('case_file_id')
            ->selectRaw('case_file_id, count(*) as pending_count')
            ->pluck('pending_count', 'case_file_id');

        $statusOrder = CaseFile::statusOrder();
        $pipelineMinStep = $statusOrder['AGREEMENT_SIGNED'] ?? 3;

        $submissions = QuestionnaireSubmission::query()
            ->whereIn('user_id', $userIds)
            ->get()
            ->keyBy('user_id');

        $rows = $profiles->map(function (ClientProfile $profile) use ($caseFiles, $submissions, $pendingByCaseFile, $statusOrder, $pipelineMinStep) {
            $caseFile   = $caseFiles->get($profile->id);
            $submission = $submissions->get($profile->user_id);
            $verification = $caseFile
                ? $this->formsVerification->getVerificationStatus($caseFile)
                : [
                    'agreement_signed'         => false,
                    'case_management_unlocked' => false,
                    'total_forms'              => 0,
                    'submitted_count'          => 0,
                    'reviewed_count'           => 0,
                ];

            $summary = $this->rules->summarizeForClientList(
                $profile->id,
                $caseFile,
                $submission,
                $verification,
            );

            $pipeline = null;
            if ($caseFile && ($statusOrder[$caseFile->status] ?? 0) >= $pipelineMinStep) {
                $pipeline = [
                    'status'              => $caseFile->status,
                    'status_label'        => self::statusLabels()[$caseFile->status]
                        ?? str_replace('_', ' ', ucwords(strtolower($caseFile->status), '_')),
                    'pending_docs'        => (int) ($pendingByCaseFile[$caseFile->id] ?? 0),
                    'agreement_signed_at' => $caseFile->agreement_signed_at?->toIso8601String(),
                ];
            }

            return [
                'id'                  => $profile->id,
                'user_id'             => $profile->user_id,
                'consultant_id'       => $profile->consultant_id,
                'phone'               => $profile->phone,
                'passport_number'     => $profile->passport_number,
                'immigration_pathway' => $profile->immigration_pathway ?? $summary['immigration_pathway'] ?? null,
                'family_id'           => $profile->family_id,
                'notes'               => $profile->notes,
                'invited_at'          => $profile->invited_at?->toIso8601String(),
                'created_at'          => $profile->created_at?->toIso8601String(),
                'user'                => $profile->user ? [
                    'id'         => $profile->user->id,
                    'name'       => $profile->user->name,
                    'email'      => $profile->user->email,
                    'phone'      => $profile->user->phone,
                    'created_at' => $profile->user->created_at?->toIso8601String(),
                ] : null,
                'case_summary' => $summary,
                'pipeline'     => $pipeline,
            ];
        });

        return new Paginator(
            $rows->values()->all(),
            $paginator->total(),
            $paginator->perPage(),
            $paginator->currentPage(),
            ['path' => $paginator->path()],
        );
    }
}
