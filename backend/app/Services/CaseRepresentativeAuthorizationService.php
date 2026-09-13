<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\User;
use App\Support\CaseWorkflowStatus;

class CaseRepresentativeAuthorizationService
{
    public const STATES = [
        'pending',
        'sent_to_client',
        'signed',
        'reviewed',
        'completed',
        'not_applicable',
        'unused',
    ];

    public function __construct(
        private CaseRequirementPlanService $plans,
        private CaseActivationService $activation,
        private CaseHistoryRecorder $history,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(CaseFile $caseFile): array
    {
        $plan = $this->plans->currentPlan($caseFile);
        $snapshot = $plan?->snapshot['representative'] ?? [];
        $requirement = $snapshot['status'] ?? 'optional';
        $visible = $requirement !== 'not_applicable';

        return [
            'visible' => $visible,
            'requirement' => $requirement,
            'form_code' => $snapshot['form_code'] ?? 'IMM5476',
            'bypass_allowed' => (bool) ($snapshot['bypass_allowed'] ?? ($requirement !== 'required')),
            'state' => $caseFile->representative_state ?? ($requirement === 'not_applicable' ? 'not_applicable' : 'pending'),
            'sent_at' => $caseFile->representative_sent_at?->toIso8601String(),
            'signed_at' => $caseFile->representative_signed_at?->toIso8601String(),
            'reviewed_at' => $caseFile->representative_reviewed_at?->toIso8601String(),
            'completed_at' => $caseFile->representative_completed_at?->toIso8601String(),
            'can_mark_na' => false,
            'can_leave_unused' => $requirement === 'optional',
            'activation' => $this->activation->serialize($caseFile),
        ];
    }

    public function initializeFromPlan(CaseFile $caseFile, ?User $actor = null): CaseFile
    {
        $plan = $this->plans->currentPlan($caseFile);
        $requirement = $plan?->snapshot['representative']['status'] ?? 'optional';

        if ($requirement === 'not_applicable') {
            $caseFile->update([
                'representative_state' => 'not_applicable',
            ]);
            $this->history->record(
                $caseFile->fresh(),
                'representative_not_applicable',
                'Representative authorization skipped from the case requirement plan',
                null,
                $actor,
                ['requirement' => $requirement],
            );

            return $this->activation->refresh($caseFile->fresh(), $actor);
        }

        if (! $caseFile->representative_state || $caseFile->representative_state === 'not_applicable') {
            $caseFile->update(['representative_state' => 'pending']);
        }

        return $caseFile->fresh();
    }

    public function sendToClient(CaseFile $caseFile, User $actor): CaseFile
    {
        $this->assertVisible($caseFile);

        $caseFile->update([
            'representative_state' => 'sent_to_client',
            'representative_sent_at' => $caseFile->representative_sent_at ?? now(),
            'workflow_status' => $this->atLeast($caseFile, CaseWorkflowStatus::REPRESENTATIVE_AUTHORIZATION_PENDING),
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'representative_sent',
            'Representative authorization sent to client',
            null,
            $actor,
        );

        return $caseFile->fresh();
    }

    public function markSigned(CaseFile $caseFile, User $actor): CaseFile
    {
        $this->assertVisible($caseFile);

        $caseFile->update([
            'representative_state' => 'signed',
            'representative_signed_at' => $caseFile->representative_signed_at ?? now(),
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'representative_signed',
            'Representative authorization signed',
            null,
            $actor,
        );

        return $caseFile->fresh();
    }

    public function review(CaseFile $caseFile, User $actor): CaseFile
    {
        $this->assertVisible($caseFile);

        $caseFile->update([
            'representative_state' => 'reviewed',
            'representative_reviewed_at' => now(),
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'representative_reviewed',
            'Representative authorization reviewed',
            null,
            $actor,
        );

        return $caseFile->fresh();
    }

    public function complete(CaseFile $caseFile, User $actor): CaseFile
    {
        $this->assertVisible($caseFile);

        $caseFile->update([
            'representative_state' => 'completed',
            'representative_completed_at' => now(),
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'representative_completed',
            'Representative authorization completed',
            null,
            $actor,
        );

        return $this->activation->refresh($caseFile->fresh(), $actor);
    }

    public function leaveUnused(CaseFile $caseFile, User $actor): CaseFile
    {
        $requirement = $this->requirement($caseFile);
        if ($requirement === 'required') {
            throw new \RuntimeException('IMM5476 is required on this case snapshot and cannot be marked unused or N/A.');
        }
        if ($requirement === 'not_applicable') {
            return $caseFile;
        }

        $caseFile->update([
            'representative_state' => 'unused',
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'representative_unused',
            'Optional representative authorization left unused',
            null,
            $actor,
        );

        return $this->activation->refresh($caseFile->fresh(), $actor);
    }

    private function requirement(CaseFile $caseFile): string
    {
        return $this->plans->currentPlan($caseFile)?->snapshot['representative']['status'] ?? 'optional';
    }

    private function assertVisible(CaseFile $caseFile): void
    {
        if ($this->requirement($caseFile) === 'not_applicable') {
            throw new \RuntimeException('Representative authorization is not applicable on this case snapshot.');
        }
    }

    private function atLeast(CaseFile $caseFile, string $minimum): string
    {
        $current = CaseWorkflowStatus::resolveForCase($caseFile->workflow_status, $caseFile->status);
        $currentOrder = CaseWorkflowStatus::ORDER[$current] ?? 0;
        $minOrder = CaseWorkflowStatus::ORDER[$minimum] ?? 0;

        return $currentOrder >= $minOrder ? $current : $minimum;
    }
}
