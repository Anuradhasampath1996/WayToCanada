<?php

namespace App\Services\ClientActivity;

use App\Enums\ClientActivityType;
use App\Models\CaseFile;
use App\Models\CaseMessage;
use App\Models\ClientMeeting;
use App\Models\ClientPaymentRequest;
use App\Models\ClientProfile;
use App\Models\DocumentSubmission;
use App\Models\CaseFeeMilestone;
use App\Models\Lms\LmsCourseAssignment;
use App\Models\MilestoneInvoice;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ClientActivityTriggers
{
    public function __construct(
        private ClientActivityRecorder $recorder,
    ) {}

    public function onClientInvited(ClientProfile $profile, User $consultant, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::CLIENT_INVITED,
            'Client invited to portal',
            'Invitation sent to ' . ($profile->user?->email ?? 'client') . '.',
            $consultant,
            'consultant',
            request: $request,
            dedupeKey: 'invite:' . now()->format('Y-m-d-H-i'),
        );
    }

    public function onQuestionnaireSubmitted(ClientProfile $profile, User $client, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::QUESTIONNAIRE_SUBMITTED,
            'Questionnaire submitted',
            $client->name . ' submitted their immigration questionnaire.',
            $client,
            'client',
            request: $request,
            dedupeKey: 'questionnaire_submitted:' . $client->id,
        );
    }

    public function onFieldVerified(ClientProfile $profile, User $consultant, string $fieldKey, bool $verified, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::QUESTIONNAIRE_FIELD_VERIFIED,
            $verified ? 'Questionnaire field verified' : 'Questionnaire verification removed',
            'Field: ' . $fieldKey,
            $consultant,
            'consultant',
            metadata: ['field_key' => $fieldKey, 'verified' => $verified],
            request: $request,
        );
    }

    public function onFieldRemark(ClientProfile $profile, User $consultant, string $fieldKey, string $remark, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::QUESTIONNAIRE_FIELD_REMARK,
            'Questionnaire correction requested',
            'Field: ' . $fieldKey . ' — ' . Str::limit($remark, 200),
            $consultant,
            'consultant',
            metadata: ['field_key' => $fieldKey],
            request: $request,
        );
    }

    public function onPathwayAssigned(ClientProfile $profile, CaseFile $caseFile, User $consultant, string $pathway, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::PATHWAY_ASSIGNED,
            'Immigration pathway assigned',
            'Pathway set to: ' . $pathway,
            $consultant,
            'consultant',
            $caseFile,
            request: $request,
        );
    }

    public function onAgreementSent(ClientProfile $profile, CaseFile $caseFile, User $consultant, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::AGREEMENT_SENT,
            'Retainer agreement sent',
            'Agreement v' . ($caseFile->agreement_version ?? 1) . ' sent for client signature.',
            $consultant,
            'consultant',
            $caseFile,
            request: $request,
        );
    }

    public function onAgreementSigned(ClientProfile $profile, CaseFile $caseFile, Request $request): void
    {
        $profile->loadMissing('user');
        $this->recorder->record(
            $profile,
            ClientActivityType::AGREEMENT_SIGNED,
            'Retainer agreement signed',
            ($profile->user?->name ?? 'Client') . ' signed the retainer agreement.',
            $profile->user,
            'client',
            $caseFile,
            request: $request,
            dedupeKey: 'agreement_signed:' . $caseFile->id,
        );
    }

    public function onDocumentUploaded(ClientProfile $profile, DocumentSubmission $submission, User $client, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::DOCUMENT_UPLOADED,
            'Document uploaded',
            '"' . $submission->document_label . '" (' . $submission->document_type . ')',
            $client,
            'client',
            $profile->caseFile,
            metadata: ['submission_id' => $submission->id, 'filename' => $submission->original_filename],
            request: $request,
        );
    }

    public function onDocumentReviewed(ClientProfile $profile, DocumentSubmission $submission, User $consultant, string $action, Request $request): void
    {
        $type = $action === 'approve' ? ClientActivityType::DOCUMENT_APPROVED : ClientActivityType::DOCUMENT_REJECTED;
        $this->recorder->record(
            $profile,
            $type,
            $action === 'approve' ? 'Document approved' : 'Document rejected',
            '"' . $submission->document_label . '"' . ($submission->rejection_comment ? ' — ' . Str::limit($submission->rejection_comment, 150) : ''),
            $consultant,
            'consultant',
            $profile->caseFile,
            metadata: ['submission_id' => $submission->id],
            request: $request,
        );
    }

    public function onCaseStatusChanged(ClientProfile $profile, CaseFile $caseFile, User $consultant, string $status, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::CASE_STATUS_CHANGED,
            'Case pipeline status updated',
            'Status changed to ' . str_replace('_', ' ', $status),
            $consultant,
            'consultant',
            $caseFile,
            metadata: ['status' => $status],
            request: $request,
        );
    }

    public function onFormsVerified(ClientProfile $profile, CaseFile $caseFile, User $consultant, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::FORMS_VERIFIED,
            'Application forms fully verified',
            'Case management hub unlocked for client.',
            $consultant,
            'consultant',
            $caseFile,
            request: $request,
            dedupeKey: 'forms_verified:' . $caseFile->id,
        );
    }

    public function onMessage(CaseMessage $message, CaseFile $caseFile, Request $request): void
    {
        $caseFile->loadMissing('clientProfile.user');
        $profile = $caseFile->clientProfile;
        if (! $profile) {
            return;
        }

        $actor = $message->sender;
        $actorType = $message->sender_type === 'client' ? 'client' : 'consultant';

        $this->recorder->record(
            $profile,
            ClientActivityType::MESSAGE_SENT,
            $actorType === 'client' ? 'Client sent a message' : 'Consultant sent a message',
            Str::limit($message->message, 200),
            $actor,
            $actorType,
            $caseFile,
            metadata: ['message_id' => $message->id],
            request: $request,
        );
    }

    public function onMeetingScheduled(ClientProfile $profile, ClientMeeting $meeting, User $consultant, Request $request): void
    {
        $when = $meeting->scheduled_at->timezone($meeting->timezone)->format('M j, Y g:i A');
        $this->recorder->record(
            $profile,
            ClientActivityType::MEETING_SCHEDULED,
            'Video meeting scheduled',
            '"' . $meeting->title . '" on ' . $when,
            $consultant,
            'consultant',
            metadata: ['meeting_id' => $meeting->id],
            request: $request,
        );
    }

    public function onMeetingCancelled(ClientProfile $profile, ClientMeeting $meeting, User $consultant, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::MEETING_CANCELLED,
            'Video meeting cancelled',
            '"' . $meeting->title . '" was cancelled.',
            $consultant,
            'consultant',
            metadata: ['meeting_id' => $meeting->id],
            request: $request,
        );
    }

    public function onPaymentRequested(ClientProfile $profile, ClientPaymentRequest $payment, User $consultant, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::PAYMENT_REQUESTED,
            'Payment request sent',
            $payment->title . ' — ' . number_format((float) $payment->amount, 2) . ' ' . $payment->currency,
            $consultant,
            'consultant',
            metadata: ['payment_id' => $payment->id],
            request: $request,
        );
    }

    public function onPaymentReceived(ClientProfile $profile, ClientPaymentRequest $payment): void
    {
        $profile->loadMissing('user');
        $this->recorder->record(
            $profile,
            ClientActivityType::PAYMENT_RECEIVED,
            'Payment received',
            $payment->title . ' marked as paid.',
            $profile->user,
            'client',
            metadata: ['payment_id' => $payment->id],
            dedupeKey: 'payment_paid:' . $payment->id,
        );
    }

    public function onLmsAssigned(ClientProfile $profile, LmsCourseAssignment $assignment, User $consultant, Request $request): void
    {
        $assignment->loadMissing('course');
        $this->recorder->record(
            $profile,
            ClientActivityType::LMS_COURSE_ASSIGNED,
            'Learning course assigned',
            'Course: ' . ($assignment->course?->title ?? 'Unknown'),
            $consultant,
            'consultant',
            metadata: ['assignment_id' => $assignment->id],
            request: $request,
        );
    }

    public function onIrccFormSubmitted(ClientProfile $profile, string $formTitle, User $client, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::IRCC_FORM_SUBMITTED,
            'IRCC form submitted',
            'Client submitted "' . $formTitle . '".',
            $client,
            'client',
            $profile->caseFile,
            request: $request,
        );
    }

    public function onIrccFormReviewed(ClientProfile $profile, string $formTitle, User $consultant, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::IRCC_FORM_REVIEWED,
            'IRCC form reviewed',
            'Consultant reviewed "' . $formTitle . '".',
            $consultant,
            'consultant',
            $profile->caseFile,
            request: $request,
        );
    }

    public function onApplicationPackageAssigned(ClientProfile $profile, CaseFile $caseFile, User $consultant, string $packageName, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::APPLICATION_PACKAGE_ASSIGNED,
            'Application package assigned',
            'Package: ' . $packageName,
            $consultant,
            'consultant',
            $caseFile,
            request: $request,
        );
    }

    public function onLmsCompleted(LmsCourseAssignment $assignment): void
    {
        $assignment->loadMissing('course', 'clientUser.clientProfile');
        $profile = $assignment->clientUser?->clientProfile;
        if (! $profile) {
            return;
        }

        $this->recorder->record(
            $profile,
            ClientActivityType::LMS_COURSE_COMPLETED,
            'Learning course completed',
            ($assignment->clientUser?->name ?? 'Client') . ' completed "' . ($assignment->course?->title ?? 'course') . '".',
            $assignment->clientUser,
            'client',
            metadata: ['assignment_id' => $assignment->id],
            dedupeKey: 'lms_completed:' . $assignment->id,
        );
    }

    public function onTrustDeposit(ClientProfile $profile, User $consultant, float $amount, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::TRUST_DEPOSIT,
            'Trust deposit recorded',
            number_format($amount, 2) . ' ' . ($profile->caseFile?->agreement_config['currency'] ?? 'CAD') . ' credited to client trust ledger.',
            $consultant,
            'consultant',
            $profile->caseFile,
            request: $request,
        );
    }

    public function onTrustRefund(ClientProfile $profile, User $consultant, float $amount, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::TRUST_REFUND,
            'Trust refund recorded',
            number_format($amount, 2) . ' refunded to client from trust ledger.',
            $consultant,
            'consultant',
            $profile->caseFile,
            request: $request,
        );
    }

    public function onMilestoneCompleted(ClientProfile $profile, CaseFeeMilestone $milestone, User $consultant, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::MILESTONE_COMPLETED,
            'Fee milestone completed',
            $milestone->label,
            $consultant,
            'consultant',
            $profile->caseFile,
            metadata: ['milestone_id' => $milestone->id],
            request: $request,
        );
    }

    public function onMilestoneInvoiced(ClientProfile $profile, MilestoneInvoice $invoice, User $consultant, Request $request): void
    {
        $invoice->loadMissing('milestone');
        $this->recorder->record(
            $profile,
            ClientActivityType::MILESTONE_INVOICED,
            'Milestone invoice issued',
            $invoice->invoice_number . ' — ' . number_format((float) $invoice->amount, 2) . ' ' . $invoice->currency,
            $consultant,
            'consultant',
            $profile->caseFile,
            metadata: ['invoice_id' => $invoice->id],
            request: $request,
        );
    }

    public function onMilestoneInvoiceApproved(ClientProfile $profile, MilestoneInvoice $invoice, User $client, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::MILESTONE_INVOICE_APPROVED,
            'Milestone invoice approved by client',
            $invoice->invoice_number . ' approved for trust release.',
            $client,
            'client',
            $profile->caseFile,
            metadata: ['invoice_id' => $invoice->id],
            request: $request,
        );
    }

    public function onTrustReleased(ClientProfile $profile, MilestoneInvoice $invoice, User $consultant, Request $request): void
    {
        $this->recorder->record(
            $profile,
            ClientActivityType::TRUST_RELEASE,
            'Trust funds released to operating',
            $invoice->invoice_number . ' — ' . number_format((float) $invoice->amount, 2) . ' ' . $invoice->currency,
            $consultant,
            'consultant',
            $profile->caseFile,
            metadata: ['invoice_id' => $invoice->id],
            request: $request,
            dedupeKey: 'trust_release:' . $invoice->id,
        );
    }
}
