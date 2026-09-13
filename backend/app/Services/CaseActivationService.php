<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\User;
use App\Support\CaseWorkflowStatus;

class CaseActivationService
{
    public function __construct(
        private CaseRequirementPlanService $plans,
        private CaseHistoryRecorder $history,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(CaseFile $caseFile): array
    {
        $plan = $this->plans->currentPlan($caseFile);
        $repStatus = $plan?->snapshot['representative']['status'] ?? 'optional';
        $agreementSigned = $caseFile->isAgreementSigned();
        $repSatisfied = $this->representativeSatisfied($caseFile, $repStatus);
        $activated = $caseFile->case_activated_at !== null || ($agreementSigned && $repSatisfied);

        return [
            'agreement_signed' => $agreementSigned,
            'representative_requirement' => $repStatus,
            'representative_satisfied' => $repSatisfied,
            'activated' => $activated,
            'activated_at' => $caseFile->case_activated_at?->toIso8601String(),
            'parallel_tracks' => $activated,
            'workflow' => CaseWorkflowStatus::serialize($caseFile->workflow_status, $caseFile->status),
        ];
    }

    public function refresh(CaseFile $caseFile, ?User $actor = null): CaseFile
    {
        $state = $this->serialize($caseFile);
        if (! $state['agreement_signed'] || ! $state['representative_satisfied']) {
            return $caseFile;
        }

        $updates = [];
        if (! $caseFile->case_activated_at) {
            $updates['case_activated_at'] = now();
        }

        $current = CaseWorkflowStatus::resolveForCase($caseFile->workflow_status, $caseFile->status);
        $order = CaseWorkflowStatus::ORDER[$current] ?? 0;
        if ($order < CaseWorkflowStatus::ORDER[CaseWorkflowStatus::CASE_ACTIVE]) {
            $updates['workflow_status'] = CaseWorkflowStatus::CASE_ACTIVE;
        }

        if ($updates === []) {
            return $caseFile;
        }

        $caseFile->update($updates);
        $fresh = $caseFile->fresh();

        if (isset($updates['case_activated_at'])) {
            $this->history->record(
                $fresh,
                'case_activated',
                'Case activated after retainer and representative requirement',
                null,
                $actor,
                [
                    'representative_requirement' => $state['representative_requirement'],
                    'representative_state' => $fresh->representative_state,
                ],
            );
        }

        return $fresh;
    }

    public function representativeSatisfied(CaseFile $caseFile, ?string $requirement = null): bool
    {
        $plan = $this->plans->currentPlan($caseFile);
        $requirement ??= $plan?->snapshot['representative']['status'] ?? 'optional';

        return match ($requirement) {
            'required' => $caseFile->representative_state === 'completed',
            'not_applicable' => true,
            default => true,
        };
    }
}
