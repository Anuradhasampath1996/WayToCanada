<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\CaseFile;
use App\Models\CaseGovernmentRequest;
use App\Models\User;
use App\Support\CaseWorkflowStatus;
use Illuminate\Support\Carbon;

class CaseGovernmentRequestService
{
    public function __construct(
        private CaseHistoryRecorder $history,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(CaseFile $caseFile): array
    {
        $requests = CaseGovernmentRequest::query()
            ->where('case_file_id', $caseFile->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn (CaseGovernmentRequest $request) => $this->serializeOne($request))
            ->all();

        return [
            'types' => CaseGovernmentRequest::TYPES,
            'requests' => $requests,
            'open_count' => collect($requests)->where('open', true)->count(),
            'submitted' => $this->isSubmitted($caseFile),
            'can_create' => $this->isSubmitted($caseFile),
            'workflow' => CaseWorkflowStatus::serialize($caseFile->workflow_status, $caseFile->status),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeOne(CaseGovernmentRequest $request): array
    {
        return [
            'id' => $request->id,
            'type' => $request->type,
            'label' => $request->label(),
            'custom_label' => $request->custom_label,
            'status' => $request->status,
            'open' => ! in_array($request->status, ['answered'], true),
            'due_at' => $request->due_at?->toIso8601String(),
            'notes' => $request->notes,
            'client_notified_at' => $request->client_notified_at?->toIso8601String(),
            'answered_at' => $request->answered_at?->toIso8601String(),
        ];
    }

    public function create(CaseFile $caseFile, User $actor, array $data): CaseGovernmentRequest
    {
        if (! $this->isSubmitted($caseFile)) {
            throw new \RuntimeException('Government requests can be added only after the case is submitted.');
        }
        $type = $data['type'];
        if ($type === 'other' && blank($data['custom_label'] ?? null)) {
            throw new \RuntimeException('Describe the custom government request.');
        }

        $request = CaseGovernmentRequest::create([
            'case_file_id' => $caseFile->id,
            'client_profile_id' => $caseFile->client_profile_id,
            'type' => $type,
            'custom_label' => $type === 'other' ? $data['custom_label'] : null,
            'status' => 'open',
            'due_at' => isset($data['due_at']) ? Carbon::parse($data['due_at']) : null,
            'notes' => $data['notes'] ?? null,
            'created_by' => $actor->id,
        ]);

        $caseFile->update([
            'workflow_status' => $this->atLeast($caseFile, CaseWorkflowStatus::GOVERNMENT_REQUEST_RECEIVED),
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'government_request_created',
            'Government request added: '.$request->label(),
            $request->notes,
            $actor,
            [
                'request_id' => $request->id,
                'type' => $request->type,
                'due_at' => $request->due_at?->toIso8601String(),
            ],
        );

        $this->notifyClient($caseFile, $request, $actor);

        return $request->fresh();
    }

    public function markResponseInProgress(CaseGovernmentRequest $request, User $actor): CaseGovernmentRequest
    {
        if ($request->status === 'answered') {
            throw new \RuntimeException('This government request is already answered.');
        }

        $request->update(['status' => 'response_in_progress']);
        $caseFile = $request->caseFile;
        $caseFile->update([
            'workflow_status' => $this->atLeast($caseFile, CaseWorkflowStatus::RESPONSE_IN_PROGRESS),
        ]);
        $this->history->record(
            $caseFile->fresh(),
            'government_request_in_progress',
            'Response in progress: '.$request->label(),
            null,
            $actor,
            ['request_id' => $request->id],
        );

        return $request->fresh();
    }

    public function markAnswered(CaseGovernmentRequest $request, User $actor, ?string $note = null): CaseGovernmentRequest
    {
        if ($request->status === 'answered') {
            return $request;
        }

        $request->update([
            'status' => 'answered',
            'answered_at' => now(),
            'answered_by' => $actor->id,
            'notes' => $note ?? $request->notes,
        ]);

        $caseFile = $request->caseFile->fresh();
        $open = CaseGovernmentRequest::query()
            ->where('case_file_id', $caseFile->id)
            ->where('status', '!=', 'answered')
            ->exists();
        if (! $open && ! $caseFile->decision_status) {
            $current = CaseWorkflowStatus::resolveForCase($caseFile->workflow_status, $caseFile->status);
            if (! in_array($current, [CaseWorkflowStatus::DECISION_RECEIVED, CaseWorkflowStatus::CASE_CLOSED], true)) {
                $caseFile->update(['workflow_status' => CaseWorkflowStatus::GOVERNMENT_PROCESSING]);
            }
        }

        $this->history->record(
            $caseFile->fresh(),
            'government_request_answered',
            'Government request answered: '.$request->label(),
            $note,
            $actor,
            ['request_id' => $request->id],
        );

        return $request->fresh();
    }

    private function notifyClient(CaseFile $caseFile, CaseGovernmentRequest $request, User $actor): void
    {
        $caseFile->loadMissing('clientProfile.user');
        $user = $caseFile->clientProfile?->user;
        if (! $user) {
            return;
        }

        app(\App\Services\Notifications\NotificationService::class)->dispatch(
            $user,
            NotificationType::CASE_STATUS_CHANGED,
            'Government request: '.$request->label(),
            ($request->due_at ? 'Due '.$request->due_at->toDateString().'. ' : '').'Your consultant recorded a government request on your file.',
            rtrim((string) env('PUBLIC_DASHBOARD_URL', 'http://localhost:3001'), '/').'/user-dashboard/government-requests',
            'gov_request:'.$request->id,
            $request,
        );

        $request->update([
            'status' => $request->status === 'open' ? 'client_notified' : $request->status,
            'client_notified_at' => $request->client_notified_at ?? now(),
        ]);
    }

    public function isSubmitted(CaseFile $caseFile): bool
    {
        return (bool) $caseFile->submitted_at
            || $caseFile->status === 'APPLICATION_SUBMITTED'
            || CaseWorkflowStatus::resolveForCase($caseFile->workflow_status, $caseFile->status) === CaseWorkflowStatus::SUBMITTED
            || (CaseWorkflowStatus::ORDER[CaseWorkflowStatus::resolveForCase($caseFile->workflow_status, $caseFile->status)] ?? 0)
                >= CaseWorkflowStatus::ORDER[CaseWorkflowStatus::SUBMITTED];
    }

    private function atLeast(CaseFile $caseFile, string $minimum): string
    {
        $current = CaseWorkflowStatus::resolveForCase($caseFile->workflow_status, $caseFile->status);
        if (in_array($current, [CaseWorkflowStatus::DECISION_RECEIVED, CaseWorkflowStatus::CASE_CLOSED], true)) {
            return $current;
        }
        $currentOrder = CaseWorkflowStatus::ORDER[$current] ?? 0;
        $minOrder = CaseWorkflowStatus::ORDER[$minimum] ?? 0;

        return $currentOrder >= $minOrder ? $current : $minimum;
    }
}
