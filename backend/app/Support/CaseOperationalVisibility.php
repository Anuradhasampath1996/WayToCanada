<?php

namespace App\Support;

use App\Models\CaseFile;
use App\Models\CaseGovernmentRequest;
use App\Models\DocumentSubmission;

/**
 * Presentation-only case visibility. Does not change workflow gates.
 */
final class CaseOperationalVisibility
{
    public const ACTOR_CONSULTANT = 'consultant';
    public const ACTOR_CLIENT = 'client';
    public const ACTOR_GOVERNMENT = 'government';

    public const JOURNEY_ASSESSMENT = 'assessment';
    public const JOURNEY_ENGAGEMENT = 'engagement';
    public const JOURNEY_PREPARATION = 'application_preparation';
    public const JOURNEY_SUBMISSION = 'submission';
    public const JOURNEY_POST = 'post_submission';

    public const JOURNEY_LABELS = [
        self::JOURNEY_ASSESSMENT => 'Assessment',
        self::JOURNEY_ENGAGEMENT => 'Engagement & Setup',
        self::JOURNEY_PREPARATION => 'Application Preparation',
        self::JOURNEY_SUBMISSION => 'Submission',
        self::JOURNEY_POST => 'Post-Submission',
    ];

    public const CLIENT_STAGE_LABELS = [
        self::JOURNEY_ASSESSMENT => 'Profile & Assessment',
        self::JOURNEY_ENGAGEMENT => 'Agreement & Case Setup',
        self::JOURNEY_PREPARATION => 'Documents & Application',
        self::JOURNEY_SUBMISSION => 'Final Review & Submission',
        self::JOURNEY_POST => 'Government Processing / Decision',
    ];

    /**
     * @param  iterable<DocumentSubmission>|null  $documents
     * @param  iterable<CaseGovernmentRequest>|null  $requests
     * @return array<string, mixed>
     */
    public static function describe(CaseFile $caseFile, ?iterable $documents = null, ?iterable $requests = null): array
    {
        $workflow = CaseWorkflowStatus::serialize($caseFile->workflow_status, $caseFile->status);
        $docs = collect($documents ?? $caseFile->documentSubmissions);
        $gov = collect($requests ?? $caseFile->governmentRequests);
        $openGov = $gov->where('status', '!=', 'answered')->values();
        $overdueGov = $openGov->first(function (CaseGovernmentRequest $request) {
            return $request->due_at && $request->due_at->isPast();
        });
        $nextDue = $openGov->filter(fn (CaseGovernmentRequest $request) => $request->due_at)
            ->sortBy(fn (CaseGovernmentRequest $request) => $request->due_at?->timestamp)
            ->first();

        $pendingReview = $docs->whereIn('status', ['pending_review', 'under_ai_review', 'ai_flagged'])->count();
        $resubmission = $docs->whereIn('status', ['resubmission_requested', 'rejected', 'correction_requested'])->count();
        $closed = in_array($caseFile->lifecycle_status, ['closed', 'completed'], true)
            || $workflow['status'] === CaseWorkflowStatus::CASE_CLOSED;

        $action = self::resolveAction(
            $workflow['status'],
            $caseFile,
            $pendingReview,
            $resubmission,
            $openGov->first(),
            $overdueGov,
            $closed,
        );

        $dueAt = $overdueGov?->due_at ?? $nextDue?->due_at;
        $overdue = (bool) $overdueGov;

        return [
            'workflow_status' => $workflow['status'],
            'workflow_label' => $workflow['label'],
            'group' => $workflow['group'],
            'journey_group' => self::journeyGroup($workflow['status']),
            'journey_label' => self::JOURNEY_LABELS[self::journeyGroup($workflow['status'])],
            'client_stage_label' => self::CLIENT_STAGE_LABELS[self::journeyGroup($workflow['status'])],
            'needs_attention' => $action !== null && ! $closed,
            'pending_action' => $action['label'] ?? null,
            'pending_actor' => $action['actor'] ?? null,
            'pending_reason' => $action['reason'] ?? null,
            'due_at' => $dueAt?->toIso8601String(),
            'overdue' => $overdue,
            'open_government_requests' => $openGov->count(),
            'pending_docs' => $pendingReview + $resubmission,
            'is_closed' => $closed,
        ];
    }

    public static function journeyGroup(string $workflow): string
    {
        $order = CaseWorkflowStatus::ORDER[$workflow] ?? 0;
        if ($order <= CaseWorkflowStatus::ORDER[CaseWorkflowStatus::PATHWAY_SELECTED]) {
            return self::JOURNEY_ASSESSMENT;
        }
        if ($order <= CaseWorkflowStatus::ORDER[CaseWorkflowStatus::REPRESENTATIVE_AUTHORIZATION_PENDING]) {
            return self::JOURNEY_ENGAGEMENT;
        }
        if ($order <= CaseWorkflowStatus::ORDER[CaseWorkflowStatus::APPLICATION_PREPARATION]) {
            return self::JOURNEY_PREPARATION;
        }
        if ($order <= CaseWorkflowStatus::ORDER[CaseWorkflowStatus::READY_TO_SUBMIT]) {
            return self::JOURNEY_SUBMISSION;
        }

        return self::JOURNEY_POST;
    }

    /**
     * @return array{label: string, actor: string, reason: string}|null
     */
    private static function resolveAction(
        string $workflow,
        CaseFile $caseFile,
        int $pendingReview,
        int $resubmission,
        ?CaseGovernmentRequest $openGov,
        ?CaseGovernmentRequest $overdueGov,
        bool $closed,
    ): ?array {
        if ($closed) {
            return null;
        }

        if ($overdueGov) {
            return [
                'label' => 'Overdue government request: '.$overdueGov->label(),
                'actor' => $overdueGov->status === 'client_notified' ? self::ACTOR_CLIENT : self::ACTOR_CONSULTANT,
                'reason' => 'overdue_government_request',
            ];
        }

        if ($resubmission > 0) {
            return [
                'label' => 'Document correction / resubmission required',
                'actor' => self::ACTOR_CLIENT,
                'reason' => 'document_resubmission',
            ];
        }

        if ($pendingReview > 0) {
            return [
                'label' => 'Consultant document review pending',
                'actor' => self::ACTOR_CONSULTANT,
                'reason' => 'consultant_review_pending',
            ];
        }

        if ($workflow === CaseWorkflowStatus::CLIENT_REVIEW && ! $caseFile->client_acknowledged_at) {
            return [
                'label' => 'Client final review pending',
                'actor' => self::ACTOR_CLIENT,
                'reason' => 'client_final_review',
            ];
        }

        if ($workflow === CaseWorkflowStatus::CONSULTANT_FINAL_REVIEW) {
            return [
                'label' => 'Consultant final review is incomplete',
                'actor' => self::ACTOR_CONSULTANT,
                'reason' => 'blocked_consultant_action',
            ];
        }

        if ($workflow === CaseWorkflowStatus::READY_TO_SUBMIT) {
            return [
                'label' => 'Confirm submission portal and record submission',
                'actor' => self::ACTOR_CONSULTANT,
                'reason' => 'blocked_consultant_action',
            ];
        }

        if ($openGov) {
            $actor = $openGov->status === 'client_notified' ? self::ACTOR_CLIENT : self::ACTOR_CONSULTANT;
            if ($openGov->status === 'open') {
                $actor = self::ACTOR_GOVERNMENT;
            }

            return [
                'label' => 'Open government request: '.$openGov->label(),
                'actor' => $actor,
                'reason' => 'open_government_request',
            ];
        }

        if ($caseFile->lifecycle_status === 'on_hold') {
            return [
                'label' => 'Case is on hold and needs consultant action',
                'actor' => self::ACTOR_CONSULTANT,
                'reason' => 'blocked_consultant_action',
            ];
        }

        return null;
    }
}
