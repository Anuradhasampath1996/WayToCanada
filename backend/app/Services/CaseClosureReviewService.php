<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\CaseGovernmentRequest;
use App\Models\User;
use App\Services\CaseFileLifecycleService;
use App\Support\CaseWorkflowStatus;

class CaseClosureReviewService
{
    public const CHECKLIST_ITEMS = [
        'final_docs_saved' => 'Final documents are saved on the case',
        'final_client_message' => 'Final client message has been sent or is not needed',
        'no_open_tasks' => 'No open government-request tasks remain',
        'payments_noted' => 'Payments have been noted',
        'gov_requests_done' => 'Government requests are complete',
        'record_complete' => 'The case record is complete',
    ];

    public function __construct(
        private CaseHistoryRecorder $history,
        private CaseFileLifecycleService $lifecycle,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(CaseFile $caseFile): array
    {
        $checklist = $this->normalized($caseFile);
        $open = CaseGovernmentRequest::query()
            ->where('case_file_id', $caseFile->id)
            ->where('status', '!=', 'answered')
            ->count();

        return [
            'checklist' => $checklist,
            'checklist_complete' => $this->complete($checklist),
            'open_government_requests' => $open,
            'reviewed_at' => $caseFile->closure_reviewed_at?->toIso8601String(),
            'can_close' => $this->complete($checklist) && $open === 0 && (bool) $caseFile->decision_status,
            'lifecycle_status' => $caseFile->lifecycle_status,
            'workflow' => CaseWorkflowStatus::serialize($caseFile->workflow_status, $caseFile->status),
        ];
    }

    /**
     * @param  array<string, bool>  $items
     */
    public function saveChecklist(CaseFile $caseFile, User $actor, array $items): CaseFile
    {
        $checklist = $this->normalized($caseFile);
        foreach (array_keys(self::CHECKLIST_ITEMS) as $key) {
            if (array_key_exists($key, $items)) {
                $checklist[$key] = [
                    'key' => $key,
                    'label' => self::CHECKLIST_ITEMS[$key],
                    'checked' => (bool) $items[$key],
                ];
            }
        }

        $caseFile->update(['closure_checklist' => $checklist]);
        $this->history->record(
            $caseFile->fresh(),
            'closure_checklist_saved',
            'Closure review checklist updated',
            null,
            $actor,
            ['items' => array_map(fn ($item) => $item['checked'] ?? false, $checklist)],
        );

        return $caseFile->fresh();
    }

    public function close(CaseFile $caseFile, User $actor, string $action = 'close', ?string $note = null): CaseFile
    {
        $state = $this->serialize($caseFile);
        if (! $state['can_close']) {
            throw new \RuntimeException('Complete the closure checklist, answer open government requests, and record a decision before closing.');
        }

        $caseFile->loadMissing('clientProfile');
        $caseFile->update([
            'closure_reviewed_at' => $caseFile->closure_reviewed_at ?? now(),
            'closure_reviewed_by' => $caseFile->closure_reviewed_by ?? $actor->id,
            'workflow_status' => CaseWorkflowStatus::CASE_CLOSED,
        ]);

        $closed = $this->lifecycle->updateLifecycle(
            $caseFile->clientProfile,
            $caseFile->fresh(),
            $action === 'complete' ? 'complete' : 'close',
            $note,
        );

        $this->history->record(
            $closed,
            'case_closed',
            $action === 'complete' ? 'Case completed after closure review' : 'Case closed after closure review',
            $note,
            $actor,
            ['lifecycle_status' => $closed->lifecycle_status],
        );

        return $closed;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function normalized(CaseFile $caseFile): array
    {
        $stored = is_array($caseFile->closure_checklist) ? $caseFile->closure_checklist : [];
        $out = [];
        foreach (self::CHECKLIST_ITEMS as $key => $label) {
            $out[$key] = [
                'key' => $key,
                'label' => $label,
                'checked' => (bool) ($stored[$key]['checked'] ?? false),
            ];
        }

        return $out;
    }

    /**
     * @param  array<string, array<string, mixed>>  $checklist
     */
    private function complete(array $checklist): bool
    {
        foreach (self::CHECKLIST_ITEMS as $key => $label) {
            if (empty($checklist[$key]['checked'])) {
                return false;
            }
        }

        return true;
    }
}
