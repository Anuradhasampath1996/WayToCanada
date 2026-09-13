<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\User;
use App\Support\CaseWorkflowStatus;
use App\Support\MapleAiBoundaries;

class CaseFinalReviewService
{
    public const CHECKLIST_ITEMS = [
        'forms_complete' => 'Forms are complete',
        'names_dates_consistent' => 'Names and dates are consistent',
        'history_complete' => 'Work, education, travel, and immigration history is complete',
        'required_documents_verified' => 'All required documents are verified',
        'inconsistencies_reviewed' => 'Inconsistency highlights have been reviewed (support only — not automatic approval)',
    ];

    public function __construct(
        private CaseRequirementPlanService $plans,
        private CaseInconsistencyHighlighter $highlighter,
        private CaseHistoryRecorder $history,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(CaseFile $caseFile, bool $forClient = false): array
    {
        $plan = $this->plans->currentPlan($caseFile);
        $snapshot = $plan?->snapshot ?? [];
        $checklist = $this->normalizedChecklist($caseFile);
        $signatureRequired = (bool) ($snapshot['client_signature_required'] ?? false);
        $ackRequired = (bool) ($snapshot['client_acknowledgement_required'] ?? true);
        $highlights = $this->highlighter->highlights($caseFile);
        $portal = $caseFile->confirmed_submission_portal ?: ($snapshot['portals']['confirmed'] ?? null);

        $package = [
            'pathway' => $caseFile->immigration_pathway,
            'pathway_code' => $caseFile->pathway_code,
            'forms' => $snapshot['forms'] ?? [],
            'documents' => $snapshot['documents'] ?? [],
            'extra_fields' => $snapshot['extra_fields'] ?? [],
            'portals' => $snapshot['portals'] ?? [],
        ];

        return [
            'checklist' => $forClient ? null : $checklist,
            'checklist_complete' => $this->checklistComplete($checklist),
            'notes' => $forClient ? null : $caseFile->final_review_notes,
            'highlights' => $highlights,
            'highlights_are_support_only' => true,
            'automatic_approval' => false,
            'package' => $package,
            'ready_for_client_review' => $caseFile->ready_for_client_review_at !== null,
            'ready_for_client_review_at' => $caseFile->ready_for_client_review_at?->toIso8601String(),
            'acknowledgement_required' => $ackRequired,
            'acknowledged' => $caseFile->client_acknowledged_at !== null,
            'acknowledged_at' => $caseFile->client_acknowledged_at?->toIso8601String(),
            'signature_required' => $signatureRequired,
            'signed' => $caseFile->client_declaration_signed_at !== null,
            'signed_at' => $caseFile->client_declaration_signed_at?->toIso8601String(),
            'confirmed_submission_portal' => $portal,
            'recommended_portals' => $snapshot['portals']['recommended'] ?? [],
            'ready_to_submit' => $caseFile->ready_to_submit_at !== null,
            'ready_to_submit_at' => $caseFile->ready_to_submit_at?->toIso8601String(),
            'submitted' => $caseFile->submitted_at !== null,
            'submitted_at' => $caseFile->submitted_at?->toIso8601String(),
            'read_only' => $forClient,
            'client_can_acknowledge' => $forClient
                && $caseFile->ready_for_client_review_at
                && ! $caseFile->client_acknowledged_at
                && ! $caseFile->submitted_at,
            'client_can_sign' => $forClient
                && $signatureRequired
                && $caseFile->ready_for_client_review_at
                && ! $caseFile->client_declaration_signed_at
                && ! $caseFile->submitted_at,
            'consultant_can_acknowledge' => false,
            'consultant_can_sign' => false,
            'can_mark_ready_for_client' => ! $forClient
                && $this->checklistComplete($checklist)
                && ! $caseFile->ready_for_client_review_at
                && ! $caseFile->submitted_at,
            'can_mark_ready_to_submit' => ! $forClient && $this->readyToSubmitSatisfied($caseFile, $snapshot),
            'maple_forbidden' => MapleAiBoundaries::FORBIDDEN_ACTIONS,
            'auto_submitted' => false,
            'workflow' => CaseWorkflowStatus::serialize($caseFile->workflow_status, $caseFile->status),
        ];
    }

    /**
     * @param  array<string, bool>  $items
     */
    public function saveChecklist(CaseFile $caseFile, User $actor, array $items, ?string $notes = null): CaseFile
    {
        $this->assertNotSubmitted($caseFile);

        $checklist = $this->normalizedChecklist($caseFile);
        foreach (array_keys(self::CHECKLIST_ITEMS) as $key) {
            if (array_key_exists($key, $items)) {
                $checklist[$key] = [
                    'key' => $key,
                    'label' => self::CHECKLIST_ITEMS[$key],
                    'checked' => (bool) $items[$key],
                    'checked_by' => $actor->id,
                    'checked_at' => now()->toIso8601String(),
                ];
            }
        }

        $caseFile->update([
            'final_review_checklist' => $checklist,
            'final_review_notes' => $notes ?? $caseFile->final_review_notes,
            'workflow_status' => $this->atLeast($caseFile, CaseWorkflowStatus::CONSULTANT_FINAL_REVIEW),
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'final_review_checklist_saved',
            'Consultant final review checklist updated',
            $notes,
            $actor,
            [
                'items' => array_map(fn ($item) => $item['checked'] ?? false, $checklist),
                'automatic_approval' => false,
            ],
        );

        return $caseFile->fresh();
    }

    public function markReadyForClientReview(CaseFile $caseFile, User $actor): CaseFile
    {
        $this->assertNotSubmitted($caseFile);
        if (! $this->checklistComplete($this->normalizedChecklist($caseFile))) {
            throw new \RuntimeException('Complete the final review checklist before marking the package ready for client review.');
        }

        $caseFile->update([
            'ready_for_client_review_at' => $caseFile->ready_for_client_review_at ?? now(),
            'ready_for_client_review_by' => $caseFile->ready_for_client_review_by ?? $actor->id,
            'workflow_status' => $this->atLeast($caseFile, CaseWorkflowStatus::CLIENT_REVIEW),
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'ready_for_client_review',
            'Package marked ready for client review',
            null,
            $actor,
            ['automatic_approval' => false],
        );

        return $caseFile->fresh();
    }

    public function acknowledge(CaseFile $caseFile, User $actor, ?string $ip = null, ?string $userAgent = null): CaseFile
    {
        $this->assertNotSubmitted($caseFile);
        $this->assertClientActor($caseFile, $actor);
        if (! $caseFile->ready_for_client_review_at) {
            throw new \RuntimeException('The consultant has not marked this package ready for client review.');
        }

        $caseFile->update([
            'client_acknowledged_at' => $caseFile->client_acknowledged_at ?? now(),
            'client_acknowledgement_ip' => $ip,
            'client_acknowledgement_user_agent' => $userAgent,
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'client_acknowledged',
            'Client acknowledged the final package',
            null,
            $actor,
            [
                'acknowledged_at' => $caseFile->fresh()->client_acknowledged_at?->toIso8601String(),
                'ip' => $ip,
            ],
        );

        return $caseFile->fresh();
    }

    public function signDeclaration(CaseFile $caseFile, User $actor, string $signature): CaseFile
    {
        $this->assertNotSubmitted($caseFile);
        $this->assertClientActor($caseFile, $actor);

        $plan = $this->plans->currentPlan($caseFile);
        if (! ($plan?->snapshot['client_signature_required'] ?? false)) {
            throw new \RuntimeException('A signature or declaration is not required for this application.');
        }
        if (! $caseFile->ready_for_client_review_at) {
            throw new \RuntimeException('The consultant has not marked this package ready for client review.');
        }
        if (mb_strlen(trim($signature)) < 3) {
            throw new \RuntimeException('Enter the client declaration signature.');
        }

        $caseFile->update([
            'client_declaration_signed_at' => $caseFile->client_declaration_signed_at ?? now(),
            'client_declaration_signature' => trim($signature),
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'client_declaration_signed',
            'Client signed the final declaration',
            null,
            $actor,
            ['signed_at' => $caseFile->fresh()->client_declaration_signed_at?->toIso8601String()],
        );

        return $caseFile->fresh();
    }

    public function markReadyToSubmit(CaseFile $caseFile, User $actor): CaseFile
    {
        $this->assertNotSubmitted($caseFile);
        $plan = $this->plans->currentPlan($caseFile);
        $snapshot = $plan?->snapshot ?? [];
        if (! $this->readyToSubmitSatisfied($caseFile, $snapshot)) {
            throw new \RuntimeException($this->readyToSubmitBlocker($caseFile, $snapshot));
        }

        $caseFile->update([
            'ready_to_submit_at' => $caseFile->ready_to_submit_at ?? now(),
            'status' => 'READY_FOR_SUBMISSION',
            'workflow_status' => $this->atLeast($caseFile, CaseWorkflowStatus::READY_TO_SUBMIT),
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'ready_to_submit',
            'Case marked ready to submit',
            null,
            $actor,
            [
                'portal' => $caseFile->confirmed_submission_portal,
                'auto_submitted' => false,
            ],
        );

        return $caseFile->fresh();
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function normalizedChecklist(CaseFile $caseFile): array
    {
        $stored = is_array($caseFile->final_review_checklist) ? $caseFile->final_review_checklist : [];
        $out = [];
        foreach (self::CHECKLIST_ITEMS as $key => $label) {
            $row = $stored[$key] ?? [];
            $out[$key] = [
                'key' => $key,
                'label' => $label,
                'checked' => (bool) ($row['checked'] ?? false),
                'checked_by' => $row['checked_by'] ?? null,
                'checked_at' => $row['checked_at'] ?? null,
            ];
        }

        return $out;
    }

    /**
     * @param  array<string, array<string, mixed>>  $checklist
     */
    public function checklistComplete(array $checklist): bool
    {
        foreach (self::CHECKLIST_ITEMS as $key => $label) {
            if (empty($checklist[$key]['checked'])) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $snapshot
     */
    public function readyToSubmitSatisfied(CaseFile $caseFile, array $snapshot): bool
    {
        if (! $caseFile->ready_for_client_review_at || $caseFile->submitted_at) {
            return false;
        }
        if (($snapshot['client_acknowledgement_required'] ?? true) && ! $caseFile->client_acknowledged_at) {
            return false;
        }
        if (($snapshot['client_signature_required'] ?? false) && ! $caseFile->client_declaration_signed_at) {
            return false;
        }
        $portal = $caseFile->confirmed_submission_portal ?: ($snapshot['portals']['confirmed'] ?? null);

        return is_string($portal) && $portal !== '';
    }

    /**
     * @param  array<string, mixed>  $snapshot
     */
    public function readyToSubmitBlocker(CaseFile $caseFile, array $snapshot): string
    {
        if (! $caseFile->ready_for_client_review_at) {
            return 'Mark the package ready for client review first.';
        }
        if (($snapshot['client_acknowledgement_required'] ?? true) && ! $caseFile->client_acknowledged_at) {
            return 'The client must acknowledge the final package before Ready to Submit.';
        }
        if (($snapshot['client_signature_required'] ?? false) && ! $caseFile->client_declaration_signed_at) {
            return 'This application requires a client signature or declaration.';
        }
        if (! $caseFile->confirmed_submission_portal && empty($snapshot['portals']['confirmed'])) {
            return 'Confirm the submission portal or method. RCICMaster does not submit to IRCC or a provincial portal.';
        }

        return 'Ready to Submit requirements are not met.';
    }

    public function assertNotSubmitted(CaseFile $caseFile): void
    {
        if ($caseFile->submitted_at) {
            throw new \RuntimeException('This case is already submitted. Submission records are immutable.');
        }
    }

    private function assertClientActor(CaseFile $caseFile, User $actor): void
    {
        $caseFile->loadMissing('clientProfile');
        if ((int) $caseFile->clientProfile?->user_id !== (int) $actor->id) {
            throw new \RuntimeException('The consultant cannot acknowledge or sign on behalf of the client.');
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
