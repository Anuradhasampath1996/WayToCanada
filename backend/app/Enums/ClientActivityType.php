<?php

namespace App\Enums;

enum ClientActivityType: string
{
    case CLIENT_INVITED = 'client_invited';
    case CLIENT_REGISTERED = 'client_registered';
    case QUESTIONNAIRE_SAVED = 'questionnaire_saved';
    case QUESTIONNAIRE_SUBMITTED = 'questionnaire_submitted';
    case QUESTIONNAIRE_FIELD_VERIFIED = 'questionnaire_field_verified';
    case QUESTIONNAIRE_FIELD_REMARK = 'questionnaire_field_remark';
    case PATHWAY_ASSIGNED = 'pathway_assigned';
    case PATHWAY_ASSESSMENT_SAVED = 'pathway_assessment_saved';
    case AGREEMENT_SENT = 'agreement_sent';
    case AGREEMENT_SIGNED = 'agreement_signed';
    case AGREEMENT_REMINDER = 'agreement_reminder';
    case APPLICATION_PACKAGE_ASSIGNED = 'application_package_assigned';
    case FORMS_VERIFIED = 'forms_verified';
    case IRCC_FORM_SUBMITTED = 'ircc_form_submitted';
    case IRCC_FORM_REVIEWED = 'ircc_form_reviewed';
    case DOCUMENT_UPLOADED = 'document_uploaded';
    case DOCUMENT_APPROVED = 'document_approved';
    case DOCUMENT_REJECTED = 'document_rejected';
    case CASE_STATUS_CHANGED = 'case_status_changed';
    case CASE_HUB_UNLOCKED = 'case_hub_unlocked';
    case MESSAGE_SENT = 'message_sent';
    case MEETING_SCHEDULED = 'meeting_scheduled';
    case MEETING_CANCELLED = 'meeting_cancelled';
    case PAYMENT_REQUESTED = 'payment_requested';
    case PAYMENT_RECEIVED = 'payment_received';
    case LMS_COURSE_ASSIGNED = 'lms_course_assigned';
    case LMS_COURSE_COMPLETED = 'lms_course_completed';
    case CONSULTANT_NOTE = 'consultant_note';
    case TRUST_DEPOSIT = 'trust_deposit';
    case TRUST_RELEASE = 'trust_release';
    case TRUST_REFUND = 'trust_refund';
    case MILESTONE_COMPLETED = 'milestone_completed';
    case MILESTONE_INVOICED = 'milestone_invoiced';
    case MILESTONE_INVOICE_APPROVED = 'milestone_invoice_approved';

    public function category(): string
    {
        return match ($this) {
            self::CLIENT_INVITED, self::CLIENT_REGISTERED => 'onboarding',
            self::QUESTIONNAIRE_SAVED, self::QUESTIONNAIRE_SUBMITTED,
            self::QUESTIONNAIRE_FIELD_VERIFIED, self::QUESTIONNAIRE_FIELD_REMARK => 'questionnaire',
            self::PATHWAY_ASSIGNED, self::PATHWAY_ASSESSMENT_SAVED => 'pathway',
            self::AGREEMENT_SENT, self::AGREEMENT_SIGNED, self::AGREEMENT_REMINDER => 'agreement',
            self::APPLICATION_PACKAGE_ASSIGNED, self::FORMS_VERIFIED,
            self::IRCC_FORM_SUBMITTED, self::IRCC_FORM_REVIEWED => 'forms',
            self::DOCUMENT_UPLOADED, self::DOCUMENT_APPROVED, self::DOCUMENT_REJECTED => 'documents',
            self::CASE_STATUS_CHANGED, self::CASE_HUB_UNLOCKED => 'case',
            self::MESSAGE_SENT => 'messages',
            self::MEETING_SCHEDULED, self::MEETING_CANCELLED => 'meetings',
            self::PAYMENT_REQUESTED, self::PAYMENT_RECEIVED,
            self::TRUST_DEPOSIT, self::TRUST_RELEASE, self::TRUST_REFUND,
            self::MILESTONE_COMPLETED, self::MILESTONE_INVOICED, self::MILESTONE_INVOICE_APPROVED => 'payments',
            self::LMS_COURSE_ASSIGNED, self::LMS_COURSE_COMPLETED => 'lms',
            self::CONSULTANT_NOTE => 'notes',
        };
    }
}
