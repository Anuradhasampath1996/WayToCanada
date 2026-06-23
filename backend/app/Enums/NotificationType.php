<?php

namespace App\Enums;

use App\Models\User;

enum NotificationType: string
{
    case NEW_MESSAGE = 'new_message';
    case AGREEMENT_SENT = 'agreement_sent';
    case AGREEMENT_SIGNED = 'agreement_signed';
    case AGREEMENT_REMINDER = 'agreement_reminder';
    case QUESTIONNAIRE_SUBMITTED = 'questionnaire_submitted';
    case MEETING_SCHEDULED = 'meeting_scheduled';
    case MEETING_CANCELLED = 'meeting_cancelled';
    case MEETING_REMINDER = 'meeting_reminder';
    case PAYMENT_REQUESTED = 'payment_requested';
    case PAYMENT_RECEIVED = 'payment_received';
    case PAYMENT_REMINDER = 'payment_reminder';
    case DOCUMENT_UPLOADED = 'document_uploaded';
    case DOCUMENT_REVIEWED = 'document_reviewed';
    case CASE_STATUS_CHANGED = 'case_status_changed';
    case COURSE_ASSIGNED = 'course_assigned';
    case LMS_COMPLETED = 'lms_completed';
    case ADMIN_BROADCAST = 'admin_broadcast';
    case SYSTEM_ALERT = 'system_alert';
    case RCIC_COMMUNITY_NEW_POST = 'rcic_community_new_post';
    case RCIC_COMMUNITY_REPLY = 'rcic_community_reply';
    case RCIC_COMMUNITY_REACTION = 'rcic_community_reaction';
    case RCIC_COMMUNITY_REPORT = 'rcic_community_report';
    case SUPPORT_TICKET_CREATED = 'support_ticket_created';
    case SUPPORT_TICKET_REPLY = 'support_ticket_reply';
    case SUPPORT_TICKET_CLOSED = 'support_ticket_closed';
    case CLIENT_CONSULTANT_REQUEST = 'client_consultant_request';
    case CLIENT_CONSULTANT_REQUEST_ACCEPTED = 'client_consultant_request_accepted';
    case CLIENT_CONSULTANT_REQUEST_DECLINED = 'client_consultant_request_declined';
    case SUBSCRIPTION_PAYMENT_SUCCEEDED = 'subscription_payment_succeeded';
    case SUBSCRIPTION_RENEWAL_FAILED = 'subscription_renewal_failed';

    /** @return list<string> */
    public function defaultChannels(): array
    {
        return match ($this) {
            self::NEW_MESSAGE => ['in_app', 'email'],
            self::AGREEMENT_SENT, self::AGREEMENT_REMINDER => ['in_app', 'whatsapp'],
            self::AGREEMENT_SIGNED => ['in_app', 'email', 'whatsapp'],
            self::QUESTIONNAIRE_SUBMITTED => ['in_app', 'email'],
            self::MEETING_SCHEDULED, self::MEETING_REMINDER => ['in_app', 'whatsapp'],
            self::MEETING_CANCELLED => ['in_app', 'email'],
            self::PAYMENT_REQUESTED, self::PAYMENT_REMINDER => ['in_app', 'whatsapp'],
            self::PAYMENT_RECEIVED => ['in_app', 'email'],
            self::DOCUMENT_UPLOADED => ['in_app', 'email'],
            self::DOCUMENT_REVIEWED => ['in_app', 'email'],
            self::CASE_STATUS_CHANGED => ['in_app', 'email'],
            self::COURSE_ASSIGNED => ['in_app', 'email'],
            self::LMS_COMPLETED => ['in_app', 'email'],
            self::ADMIN_BROADCAST => ['in_app', 'email'],
            self::SYSTEM_ALERT => ['in_app', 'email'],
            self::RCIC_COMMUNITY_NEW_POST, self::RCIC_COMMUNITY_REPLY, self::RCIC_COMMUNITY_REACTION, self::RCIC_COMMUNITY_REPORT => ['in_app'],
            self::SUPPORT_TICKET_CREATED, self::SUPPORT_TICKET_REPLY, self::SUPPORT_TICKET_CLOSED => ['in_app', 'email'],
            self::CLIENT_CONSULTANT_REQUEST, self::CLIENT_CONSULTANT_REQUEST_ACCEPTED, self::CLIENT_CONSULTANT_REQUEST_DECLINED => ['in_app', 'email'],
            self::SUBSCRIPTION_PAYMENT_SUCCEEDED, self::SUBSCRIPTION_RENEWAL_FAILED => ['in_app', 'email', 'whatsapp'],
        };
    }

    /**
     * Resolve delivery channels for a recipient, including WhatsApp for consultants and clients.
     *
     * @param list<string>|null $explicit
     * @return list<string>
     */
    public function channelsFor(User $user, ?array $explicit = null): array
    {
        $channels = $explicit ?? $this->defaultChannels();

        if ($user->hasAnyRole(['rcic', 'client'])) {
            $channels = $this->ensureWhatsApp($channels);
        }

        return $channels;
    }

    /** @param list<string> $channels @return list<string> */
    private function ensureWhatsApp(array $channels): array
    {
        if (! in_array('whatsapp', $channels, true)) {
            $channels[] = 'whatsapp';
        }

        return array_values(array_unique($channels));
    }

    public function category(): string
    {
        return match ($this) {
            self::NEW_MESSAGE => 'messages',
            self::AGREEMENT_SENT, self::AGREEMENT_SIGNED, self::AGREEMENT_REMINDER => 'agreements',
            self::QUESTIONNAIRE_SUBMITTED => 'questionnaire',
            self::MEETING_SCHEDULED, self::MEETING_CANCELLED, self::MEETING_REMINDER => 'meetings',
            self::PAYMENT_REQUESTED, self::PAYMENT_RECEIVED, self::PAYMENT_REMINDER => 'payments',
            self::DOCUMENT_UPLOADED, self::DOCUMENT_REVIEWED => 'documents',
            self::CASE_STATUS_CHANGED => 'case',
            self::COURSE_ASSIGNED, self::LMS_COMPLETED => 'lms',
            self::ADMIN_BROADCAST, self::SYSTEM_ALERT => 'system',
            self::RCIC_COMMUNITY_NEW_POST, self::RCIC_COMMUNITY_REPLY, self::RCIC_COMMUNITY_REACTION, self::RCIC_COMMUNITY_REPORT => 'community',
            self::SUPPORT_TICKET_CREATED, self::SUPPORT_TICKET_REPLY, self::SUPPORT_TICKET_CLOSED => 'support',
            self::CLIENT_CONSULTANT_REQUEST, self::CLIENT_CONSULTANT_REQUEST_ACCEPTED, self::CLIENT_CONSULTANT_REQUEST_DECLINED => 'onboarding',
            self::SUBSCRIPTION_PAYMENT_SUCCEEDED, self::SUBSCRIPTION_RENEWAL_FAILED => 'billing',
        };
    }

    public function categoryLabel(): string
    {
        return match ($this->category()) {
            'messages'      => 'Message',
            'agreements'    => 'Agreement',
            'questionnaire' => 'Questionnaire',
            'meetings'      => 'Meeting',
            'payments'      => 'Payment',
            'documents'     => 'Document',
            'case'          => 'Case update',
            'lms'           => 'Learning',
            'system'        => 'System',
            'community'     => 'Community',
            'support'       => 'Support',
            'onboarding'    => 'Onboarding',
            'billing'         => 'Billing',
            default         => 'Notification',
        };
    }

    public function emailActionLabel(): string
    {
        return match ($this) {
            self::NEW_MESSAGE => 'Open messages',
            self::AGREEMENT_SIGNED => 'Open client workspace',
            self::QUESTIONNAIRE_SUBMITTED => 'Review questionnaire',
            self::MEETING_CANCELLED => 'View meetings',
            self::PAYMENT_RECEIVED => 'View payment',
            self::DOCUMENT_UPLOADED, self::DOCUMENT_REVIEWED => 'Open documents',
            self::CASE_STATUS_CHANGED => 'View case',
            self::COURSE_ASSIGNED, self::LMS_COMPLETED => 'Open learning',
            self::ADMIN_BROADCAST, self::SYSTEM_ALERT => 'Open dashboard',
            self::SUPPORT_TICKET_CREATED, self::SUPPORT_TICKET_REPLY, self::SUPPORT_TICKET_CLOSED => 'Open support ticket',
            self::CLIENT_CONSULTANT_REQUEST, self::CLIENT_CONSULTANT_REQUEST_ACCEPTED, self::CLIENT_CONSULTANT_REQUEST_DECLINED => 'Open dashboard',
            self::SUBSCRIPTION_PAYMENT_SUCCEEDED, self::SUBSCRIPTION_RENEWAL_FAILED => 'Open billing',
            default => 'View details',
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::NEW_MESSAGE => 'New message',
            self::AGREEMENT_SENT => 'Agreement sent',
            self::AGREEMENT_SIGNED => 'Agreement signed',
            self::AGREEMENT_REMINDER => 'Agreement reminder',
            self::QUESTIONNAIRE_SUBMITTED => 'Questionnaire submitted',
            self::MEETING_SCHEDULED => 'Meeting scheduled',
            self::MEETING_CANCELLED => 'Meeting cancelled',
            self::MEETING_REMINDER => 'Meeting reminder',
            self::PAYMENT_REQUESTED => 'Payment requested',
            self::PAYMENT_RECEIVED => 'Payment received',
            self::PAYMENT_REMINDER => 'Payment reminder',
            self::DOCUMENT_UPLOADED => 'Document uploaded',
            self::DOCUMENT_REVIEWED => 'Document reviewed',
            self::CASE_STATUS_CHANGED => 'Case status changed',
            self::COURSE_ASSIGNED => 'Course assigned',
            self::LMS_COMPLETED => 'Course completed',
            self::ADMIN_BROADCAST => 'Admin broadcast',
            self::SYSTEM_ALERT => 'System alert',
            self::RCIC_COMMUNITY_NEW_POST => 'Community new post',
            self::RCIC_COMMUNITY_REPLY => 'Community reply',
            self::RCIC_COMMUNITY_REACTION => 'Community reaction',
            self::RCIC_COMMUNITY_REPORT => 'Community report',
            self::SUPPORT_TICKET_CREATED => 'Support ticket created',
            self::SUPPORT_TICKET_REPLY => 'Support ticket reply',
            self::SUPPORT_TICKET_CLOSED => 'Support ticket closed',
            self::CLIENT_CONSULTANT_REQUEST => 'Consultant request',
            self::CLIENT_CONSULTANT_REQUEST_ACCEPTED => 'Consultant request accepted',
            self::CLIENT_CONSULTANT_REQUEST_DECLINED => 'Consultant request declined',
            self::SUBSCRIPTION_PAYMENT_SUCCEEDED => 'Subscription payment received',
            self::SUBSCRIPTION_RENEWAL_FAILED => 'Subscription renewal failed',
        };
    }

    /** @return list<'admin'|'consultant'|'client'> */
    public function typicalAudiences(): array
    {
        return match ($this) {
            self::NEW_MESSAGE => ['client', 'consultant'],
            self::AGREEMENT_SENT, self::AGREEMENT_REMINDER => ['client'],
            self::AGREEMENT_SIGNED => ['consultant'],
            self::QUESTIONNAIRE_SUBMITTED => ['consultant'],
            self::MEETING_SCHEDULED, self::MEETING_REMINDER, self::MEETING_CANCELLED => ['client', 'consultant'],
            self::PAYMENT_REQUESTED, self::PAYMENT_REMINDER => ['client'],
            self::PAYMENT_RECEIVED => ['consultant'],
            self::DOCUMENT_UPLOADED => ['consultant'],
            self::DOCUMENT_REVIEWED => ['client'],
            self::CASE_STATUS_CHANGED => ['client', 'consultant'],
            self::COURSE_ASSIGNED, self::LMS_COMPLETED => ['client'],
            self::ADMIN_BROADCAST => ['consultant'],
            self::SYSTEM_ALERT => ['admin', 'consultant'],
            self::SUPPORT_TICKET_CREATED, self::SUPPORT_TICKET_REPLY => ['admin', 'consultant'],
            self::SUPPORT_TICKET_CLOSED => ['consultant'],
            self::CLIENT_CONSULTANT_REQUEST => ['consultant'],
            self::CLIENT_CONSULTANT_REQUEST_ACCEPTED, self::CLIENT_CONSULTANT_REQUEST_DECLINED => ['client'],
            self::SUBSCRIPTION_PAYMENT_SUCCEEDED, self::SUBSCRIPTION_RENEWAL_FAILED => ['consultant'],
            default => ['consultant'],
        };
    }
}
