<?php

namespace App\Enums;

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
            self::SUPPORT_TICKET_CREATED, self::SUPPORT_TICKET_REPLY, self::SUPPORT_TICKET_CLOSED => ['in_app'],
            self::CLIENT_CONSULTANT_REQUEST, self::CLIENT_CONSULTANT_REQUEST_ACCEPTED, self::CLIENT_CONSULTANT_REQUEST_DECLINED => ['in_app', 'email'],
        };
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
        };
    }
}
