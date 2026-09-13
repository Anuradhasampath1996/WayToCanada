<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\CaseHistoryEvent;
use App\Models\DocumentSubmission;
use App\Models\IrccInteractiveFormResponse;
use App\Models\User;
use App\Support\CaseWorkflowStatus;
use App\Support\DocumentWorkflowStatus;
use Illuminate\Http\UploadedFile;

class CaseSubmissionConfirmationService
{
    public function __construct(
        private CaseFinalReviewService $review,
        private CaseRequirementPlanService $plans,
        private CaseHistoryRecorder $history,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(CaseFile $caseFile): array
    {
        return [
            'submitted' => $caseFile->submitted_at !== null,
            'submitted_at' => $caseFile->submitted_at?->toIso8601String(),
            'submission_date' => $caseFile->submission_date?->toDateString(),
            'application_number' => $caseFile->application_number,
            'confirmation_number' => $caseFile->confirmation_number,
            'government_fees' => $caseFile->government_fees,
            'payment_confirmation' => $caseFile->payment_confirmation,
            'receipt_path' => $caseFile->receipt_path,
            'has_receipt' => (bool) $caseFile->receipt_path,
            'submitted_documents_snapshot' => $caseFile->submitted_documents_snapshot,
            'confirmed_submission_portal' => $caseFile->confirmed_submission_portal,
            'auto_submitted' => false,
            'immutable' => $caseFile->submitted_at !== null,
        ];
    }

    /**
     * Record a government/provincial submission confirmation. Never calls IRCC.
     *
     * @param  array<string, mixed>  $fields
     */
    public function record(CaseFile $caseFile, User $actor, array $fields, ?UploadedFile $receipt = null): CaseFile
    {
        $this->review->assertNotSubmitted($caseFile);

        if (! $caseFile->ready_to_submit_at) {
            throw new \RuntimeException('Mark the case Ready to Submit before recording a submission confirmation.');
        }

        $snapshot = $this->plans->currentPlan($caseFile)?->snapshot ?? [];
        if (! $this->review->readyToSubmitSatisfied($caseFile, $snapshot)) {
            throw new \RuntimeException($this->review->readyToSubmitBlocker($caseFile, $snapshot));
        }

        $receiptPath = $caseFile->receipt_path;
        if ($receipt) {
            $receiptPath = $receipt->store('private/case-submissions/'.$caseFile->id, 'local');
        }

        $docsSnapshot = $this->buildDocumentSnapshot($caseFile);
        $caseFile->update([
            'submitted_at' => now(),
            'submission_date' => $fields['submission_date'] ?? now()->toDateString(),
            'application_number' => $fields['application_number'] ?? null,
            'confirmation_number' => $fields['confirmation_number'] ?? null,
            'government_fees' => $fields['government_fees'] ?? null,
            'payment_confirmation' => $fields['payment_confirmation'] ?? null,
            'receipt_path' => $receiptPath,
            'submitted_documents_snapshot' => $docsSnapshot,
            'status' => 'APPLICATION_SUBMITTED',
            'workflow_status' => CaseWorkflowStatus::SUBMITTED,
        ]);

        $this->history->record(
            $caseFile->fresh(),
            'application_submitted',
            'Application submission confirmation recorded',
            'Recorded in RCICMaster only. Nothing was sent to IRCC or a provincial portal.',
            $actor,
            [
                'submission_date' => $caseFile->fresh()->submission_date?->toDateString(),
                'application_number' => $caseFile->fresh()->application_number,
                'confirmation_number' => $caseFile->fresh()->confirmation_number,
                'government_fees' => $caseFile->fresh()->government_fees,
                'payment_confirmation' => $caseFile->fresh()->payment_confirmation,
                'receipt_path' => $receiptPath,
                'portal' => $caseFile->confirmed_submission_portal,
                'auto_submitted' => false,
                'document_count' => count($docsSnapshot['documents'] ?? []),
            ],
        );

        return $caseFile->fresh();
    }

    /**
     * @return array{captured_at: string, documents: list<array<string, mixed>>, forms: list<array<string, mixed>>}
     */
    public function buildDocumentSnapshot(CaseFile $caseFile): array
    {
        $documents = DocumentSubmission::query()
            ->where('case_file_id', $caseFile->id)
            ->orderBy('id')
            ->get()
            ->map(fn (DocumentSubmission $doc) => [
                'id' => $doc->id,
                'document_type' => $doc->document_type,
                'document_label' => $doc->document_label,
                'original_filename' => $doc->original_filename,
                'status' => $doc->status,
                'workflow_status' => DocumentWorkflowStatus::canonicalize($doc->status),
            ])
            ->all();

        $forms = IrccInteractiveFormResponse::query()
            ->where('case_file_id', $caseFile->id)
            ->orderBy('id')
            ->get()
            ->map(fn (IrccInteractiveFormResponse $form) => [
                'id' => $form->id,
                'status' => $form->status,
                'submitted_at' => $form->submitted_at?->toIso8601String(),
                'reviewed_at' => $form->reviewed_at?->toIso8601String(),
            ])
            ->all();

        return [
            'captured_at' => now()->toIso8601String(),
            'documents' => $documents,
            'forms' => $forms,
        ];
    }

    public function submissionEvent(CaseFile $caseFile): ?CaseHistoryEvent
    {
        return CaseHistoryEvent::query()
            ->where('case_file_id', $caseFile->id)
            ->where('event_type', 'application_submitted')
            ->orderBy('id')
            ->first();
    }
}
