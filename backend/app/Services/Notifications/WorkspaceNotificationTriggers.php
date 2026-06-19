<?php

namespace App\Services\Notifications;

use App\Enums\NotificationType;
use App\Models\CaseFile;
use App\Models\CaseMessage;
use App\Models\ClientMeeting;
use App\Models\ClientPaymentRequest;
use App\Models\ClientProfile;
use App\Models\DocumentSubmission;
use App\Models\Lms\LmsCourseAssignment;
use App\Models\User;
use App\Support\NotificationUrlBuilder;
use Illuminate\Support\Str;

class WorkspaceNotificationTriggers
{
    public function __construct(
        private NotificationService $notifications,
    ) {}

    public function onNewMessage(CaseMessage $message, CaseFile $caseFile): void
    {
        $caseFile->loadMissing('clientProfile.user', 'consultant');
        $profile    = $caseFile->clientProfile;
        $consultant = $caseFile->consultant;
        $preview    = Str::limit($message->message, 120);

        if ($message->sender_type === 'consultant' && $profile?->user) {
            $this->notifications->dispatch(
                $profile->user,
                NotificationType::NEW_MESSAGE,
                'New message from your consultant',
                $preview,
                NotificationUrlBuilder::clientCaseManagement(),
                'message:' . $message->id . ':to:client',
                $message,
            );
        }

        if ($message->sender_type === 'client' && $consultant && $profile) {
            $clientName = $profile->user?->name ?? 'Client';
            $this->notifications->dispatch(
                $consultant,
                NotificationType::NEW_MESSAGE,
                "New message from {$clientName}",
                $preview,
                NotificationUrlBuilder::consultantClientWorkspace($profile->id, 'case-management'),
                'message:' . $message->id . ':to:consultant',
                $message,
            );
        }
    }

    public function onAgreementSent(ClientProfile $profile, CaseFile $caseFile, User $consultant): void
    {
        $profile->loadMissing('user');
        if (! $profile->user) {
            return;
        }

        $this->notifications->dispatch(
            $profile->user,
            NotificationType::AGREEMENT_SENT,
            'Retainer agreement ready to sign',
            "{$consultant->name} sent your retainer agreement. Please review and sign when ready.",
            NotificationUrlBuilder::clientRetainerAgreement(),
            'agreement_sent:' . $caseFile->id . ':v' . ($caseFile->agreement_version ?? 1),
            $caseFile,
        );
    }

    public function onAgreementSigned(CaseFile $caseFile): void
    {
        $caseFile->loadMissing('clientProfile.user', 'consultant');
        $profile    = $caseFile->clientProfile;
        $consultant = $caseFile->consultant;

        if (! $profile || ! $consultant) {
            return;
        }

        $clientName = $profile->user?->name ?? 'Your client';
        $this->notifications->dispatch(
            $consultant,
            NotificationType::AGREEMENT_SIGNED,
            'Retainer agreement signed',
            "{$clientName} signed the retainer agreement. You can continue with the next workspace steps.",
            NotificationUrlBuilder::consultantClientWorkspace($profile->id, 'retainer-agreement'),
            'agreement_signed:' . $caseFile->id,
            $caseFile,
        );
    }

    public function onQuestionnaireSubmitted(User $client, User $consultant, int $profileId): void
    {
        $this->notifications->dispatch(
            $consultant,
            NotificationType::QUESTIONNAIRE_SUBMITTED,
            'Questionnaire submitted',
            "{$client->name} submitted their immigration questionnaire for your review.",
            NotificationUrlBuilder::consultantClientWorkspace($profileId, 'questionnaire-review'),
            'questionnaire_submitted:' . $client->id,
            null,
        );
    }

    public function onMeetingScheduled(ClientProfile $profile, ClientMeeting $meeting, User $consultant): void
    {
        $profile->loadMissing('user');
        if (! $profile->user) {
            return;
        }

        $when = $meeting->scheduled_at->timezone($meeting->timezone)->format('M j, Y g:i A T');
        $this->notifications->dispatch(
            $profile->user,
            NotificationType::MEETING_SCHEDULED,
            'Video meeting scheduled',
            "{$consultant->name} scheduled \"{$meeting->title}\" for {$when}.",
            NotificationUrlBuilder::publicMeeting($meeting->token),
            'meeting_scheduled:' . $meeting->id,
            $meeting,
        );
    }

    public function onMeetingCancelled(ClientProfile $profile, ClientMeeting $meeting, User $consultant): void
    {
        $profile->loadMissing('user');
        if (! $profile->user) {
            return;
        }

        $this->notifications->dispatch(
            $profile->user,
            NotificationType::MEETING_CANCELLED,
            'Video meeting cancelled',
            "{$consultant->name} cancelled the meeting \"{$meeting->title}\".",
            NotificationUrlBuilder::clientCaseManagement(),
            'meeting_cancelled:' . $meeting->id,
            $meeting,
        );
    }

    public function onPaymentRequested(ClientProfile $profile, ClientPaymentRequest $request, User $consultant): void
    {
        $profile->loadMissing('user');
        if (! $profile->user) {
            return;
        }

        $amount = number_format((float) $request->amount, 2) . ' ' . $request->currency;
        $this->notifications->dispatch(
            $profile->user,
            NotificationType::PAYMENT_REQUESTED,
            'Payment request received',
            "{$consultant->name} requested {$amount} for \"{$request->title}\".",
            NotificationUrlBuilder::publicPayment($request->token),
            'payment_requested:' . $request->id,
            $request,
        );
    }

    public function onPaymentReceived(ClientPaymentRequest $paymentRequest): void
    {
        $paymentRequest->loadMissing('consultant', 'clientProfile.user');
        $consultant = $paymentRequest->consultant;
        $profile    = $paymentRequest->clientProfile;

        if (! $consultant || ! $profile) {
            return;
        }

        $clientName = $profile->user?->name ?? 'Client';
        $amount     = number_format((float) $paymentRequest->amount, 2) . ' ' . $paymentRequest->currency;

        $this->notifications->dispatch(
            $consultant,
            NotificationType::PAYMENT_RECEIVED,
            'Payment received',
            "{$clientName} paid {$amount} for \"{$paymentRequest->title}\".",
            NotificationUrlBuilder::consultantClientWorkspace($profile->id),
            'payment_received:' . $paymentRequest->id,
            $paymentRequest,
        );
    }

    public function onPaymentReminder(ClientProfile $profile, ClientPaymentRequest $paymentRequest, User $consultant): void
    {
        $profile->loadMissing('user');
        if (! $profile->user) {
            return;
        }

        $amount = number_format((float) $paymentRequest->amount, 2) . ' ' . $paymentRequest->currency;
        $this->notifications->dispatch(
            $profile->user,
            NotificationType::PAYMENT_REMINDER,
            'Payment reminder',
            "Reminder: {$amount} is still due for \"{$paymentRequest->title}\".",
            NotificationUrlBuilder::publicPayment($paymentRequest->token),
            'payment_reminder:' . $paymentRequest->id . ':' . now()->format('Y-m-d'),
            $paymentRequest,
            ['in_app', 'email', 'whatsapp'],
        );
    }

    public function onMeetingReminder(ClientMeeting $meeting, string $window): void
    {
        $meeting->loadMissing('clientProfile.user', 'consultant');
        $profile    = $meeting->clientProfile;
        $consultant = $meeting->consultant;

        if (! $profile?->user || ! $consultant) {
            return;
        }

        $when   = $meeting->scheduled_at->timezone($meeting->timezone)->format('M j, g:i A T');
        $label  = $window === '1h' ? 'in 1 hour' : 'in 24 hours';
        $dedupe = 'meeting_reminder:' . $window . ':' . $meeting->id;

        $this->notifications->dispatch(
            $profile->user,
            NotificationType::MEETING_REMINDER,
            'Meeting reminder',
            "\"{$meeting->title}\" with {$consultant->name} starts {$label} ({$when}).",
            NotificationUrlBuilder::publicMeeting($meeting->token),
            $dedupe . ':client',
            $meeting,
            ['in_app', 'email', 'whatsapp'],
        );

        $clientName = $profile->user->name ?? 'Client';
        $this->notifications->dispatch(
            $consultant,
            NotificationType::MEETING_REMINDER,
            'Meeting reminder',
            "\"{$meeting->title}\" with {$clientName} starts {$label} ({$when}).",
            NotificationUrlBuilder::consultantClientWorkspace($profile->id),
            $dedupe . ':consultant',
            $meeting,
            ['in_app', 'email'],
        );
    }

    public function onDocumentUploaded(DocumentSubmission $submission, CaseFile $caseFile): void
    {
        $caseFile->loadMissing('clientProfile.user', 'consultant');
        $profile    = $caseFile->clientProfile;
        $consultant = $caseFile->consultant;

        if (! $consultant || ! $profile) {
            return;
        }

        $clientName = $profile->user?->name ?? 'Client';
        $this->notifications->dispatch(
            $consultant,
            NotificationType::DOCUMENT_UPLOADED,
            'New document uploaded',
            "{$clientName} uploaded \"{$submission->document_label}\" for review.",
            NotificationUrlBuilder::consultantClientDocuments($profile->id),
            'document_uploaded:' . $submission->id,
            $submission,
        );
    }

    public function onDocumentReviewed(DocumentSubmission $submission, ClientProfile $profile, string $action): void
    {
        $profile->loadMissing('user');
        if (! $profile->user) {
            return;
        }

        $approved = $action === 'approve';
        $this->notifications->dispatch(
            $profile->user,
            NotificationType::DOCUMENT_REVIEWED,
            $approved ? 'Document approved' : 'Document needs attention',
            $approved
                ? "Your document \"{$submission->document_label}\" was approved."
                : "Your document \"{$submission->document_label}\" was rejected. Check messages for details.",
            NotificationUrlBuilder::clientCaseManagement(),
            'document_reviewed:' . $submission->id . ':' . $action,
            $submission,
        );
    }

    public function onCaseStatusChanged(ClientProfile $profile, CaseFile $caseFile, string $newStatus): void
    {
        $profile->loadMissing('user');
        if (! $profile->user) {
            return;
        }

        $labels = [
            'DOCUMENTS_UPLOADING'     => 'Document collection in progress',
            'UNDER_REVIEW'            => 'Your case is under review',
            'READY_FOR_SUBMISSION'    => 'Your application is ready for submission',
            'APPLICATION_SUBMITTED'   => 'Application submitted',
            'AGREEMENT_SIGNED'        => 'Agreement signed — next steps unlocked',
        ];

        $label = $labels[$newStatus] ?? 'Case status updated';
        $this->notifications->dispatch(
            $profile->user,
            NotificationType::CASE_STATUS_CHANGED,
            'Case update',
            $label,
            NotificationUrlBuilder::clientCaseManagement(),
            'case_status:' . $caseFile->id . ':' . $newStatus,
            $caseFile,
        );
    }

    public function onCourseAssigned(ClientProfile $profile, LmsCourseAssignment $assignment, User $consultant): void
    {
        $profile->loadMissing('user');
        $assignment->loadMissing('course');
        if (! $profile->user) {
            return;
        }

        $courseTitle = $assignment->course?->title ?? 'a new course';
        $this->notifications->dispatch(
            $profile->user,
            NotificationType::COURSE_ASSIGNED,
            'New learning course assigned',
            "{$consultant->name} assigned you \"{$courseTitle}\".",
            NotificationUrlBuilder::clientLearning($assignment->id),
            'course_assigned:' . $assignment->id,
            $assignment,
        );
    }

    public function onLmsCourseCompleted(LmsCourseAssignment $assignment): void
    {
        $assignment->loadMissing('course', 'clientUser.clientProfile');
        $client     = $assignment->clientUser;
        $profile    = $client?->clientProfile;
        $consultant = $profile?->consultant;

        if (! $consultant || ! $profile || ! $client) {
            return;
        }

        $courseTitle = $assignment->course?->title ?? 'Course';
        $this->notifications->dispatch(
            $consultant,
            NotificationType::LMS_COMPLETED,
            'Course completed',
            "{$client->name} completed \"{$courseTitle}\".",
            NotificationUrlBuilder::consultantClientLms($profile->id),
            'lms_completed:' . $assignment->id,
            $assignment,
        );
    }

    public function onClientConsultantRequest(\App\Models\ConsultantClientRequest $request): void
    {
        $request->loadMissing('clientUser', 'consultant');
        $client     = $request->clientUser;
        $consultant = $request->consultant;

        if (! $client || ! $consultant) {
            return;
        }

        $this->notifications->dispatch(
            $consultant,
            NotificationType::CLIENT_CONSULTANT_REQUEST,
            'New client request',
            "{$client->name} would like you to be their immigration consultant.",
            NotificationUrlBuilder::consultantClientRequests($request->id),
            'client_request:' . $request->id,
            $request,
        );
    }

    public function onClientConsultantRequestAccepted(\App\Models\ConsultantClientRequest $request, ClientProfile $profile): void
    {
        $request->loadMissing('clientUser', 'consultant');
        $client     = $request->clientUser;
        $consultant = $request->consultant;

        if (! $client || ! $consultant) {
            return;
        }

        $this->notifications->dispatch(
            $client,
            NotificationType::CLIENT_CONSULTANT_REQUEST_ACCEPTED,
            'Consultant accepted your request',
            "{$consultant->name} accepted your request. Your immigration workspace is now active.",
            NotificationUrlBuilder::clientDashboard(),
            'client_request_accepted:' . $request->id,
            $profile,
        );
    }

    public function onClientConsultantRequestDeclined(\App\Models\ConsultantClientRequest $request): void
    {
        $request->loadMissing('clientUser', 'consultant');
        $client     = $request->clientUser;
        $consultant = $request->consultant;

        if (! $client || ! $consultant) {
            return;
        }

        $this->notifications->dispatch(
            $client,
            NotificationType::CLIENT_CONSULTANT_REQUEST_DECLINED,
            'Consultant declined your request',
            "{$consultant->name} is unable to take your case right now. You can choose another consultant.",
            NotificationUrlBuilder::clientChooseConsultant(),
            'client_request_declined:' . $request->id,
            $request,
        );
    }
}
