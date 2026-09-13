<?php

namespace App\Support;

/**
 * Full internal case workflow status model (D6).
 * Legacy case_files.status values keep working via fromLegacy().
 */
final class CaseWorkflowStatus
{
    public const INITIAL_CONSULTATION = 'INITIAL_CONSULTATION';
    public const PROFILE_REVIEW = 'PROFILE_REVIEW';
    public const ELIGIBILITY_ASSESSMENT = 'ELIGIBILITY_ASSESSMENT';
    public const PATHWAY_RECOMMENDED = 'PATHWAY_RECOMMENDED';
    public const PATHWAY_SELECTED = 'PATHWAY_SELECTED';
    public const RETAINER_PENDING = 'RETAINER_PENDING';
    public const REPRESENTATIVE_AUTHORIZATION_PENDING = 'REPRESENTATIVE_AUTHORIZATION_PENDING';
    public const CASE_ACTIVE = 'CASE_ACTIVE';
    public const ADDITIONAL_DATA_COLLECTION = 'ADDITIONAL_DATA_COLLECTION';
    public const DOCUMENT_COLLECTION = 'DOCUMENT_COLLECTION';
    public const DOCUMENT_REVIEW = 'DOCUMENT_REVIEW';
    public const APPLICATION_PREPARATION = 'APPLICATION_PREPARATION';
    public const CONSULTANT_FINAL_REVIEW = 'CONSULTANT_FINAL_REVIEW';
    public const CLIENT_REVIEW = 'CLIENT_REVIEW';
    public const READY_TO_SUBMIT = 'READY_TO_SUBMIT';
    public const SUBMITTED = 'SUBMITTED';
    public const GOVERNMENT_PROCESSING = 'GOVERNMENT_PROCESSING';
    public const GOVERNMENT_REQUEST_RECEIVED = 'GOVERNMENT_REQUEST_RECEIVED';
    public const RESPONSE_IN_PROGRESS = 'RESPONSE_IN_PROGRESS';
    public const DECISION_RECEIVED = 'DECISION_RECEIVED';
    public const CASE_CLOSED = 'CASE_CLOSED';

    public const GROUP_PRE_ENGAGEMENT = 'pre_engagement';
    public const GROUP_ACTIVE_CASE = 'active_case';
    public const GROUP_POST_SUBMISSION = 'post_submission';

    /** @var array<string, int> */
    public const ORDER = [
        self::INITIAL_CONSULTATION => 0,
        self::PROFILE_REVIEW => 1,
        self::ELIGIBILITY_ASSESSMENT => 2,
        self::PATHWAY_RECOMMENDED => 3,
        self::PATHWAY_SELECTED => 4,
        self::RETAINER_PENDING => 5,
        self::REPRESENTATIVE_AUTHORIZATION_PENDING => 6,
        self::CASE_ACTIVE => 7,
        self::ADDITIONAL_DATA_COLLECTION => 8,
        self::DOCUMENT_COLLECTION => 9,
        self::DOCUMENT_REVIEW => 10,
        self::APPLICATION_PREPARATION => 11,
        self::CONSULTANT_FINAL_REVIEW => 12,
        self::CLIENT_REVIEW => 13,
        self::READY_TO_SUBMIT => 14,
        self::SUBMITTED => 15,
        self::GOVERNMENT_PROCESSING => 16,
        self::GOVERNMENT_REQUEST_RECEIVED => 17,
        self::RESPONSE_IN_PROGRESS => 18,
        self::DECISION_RECEIVED => 19,
        self::CASE_CLOSED => 20,
    ];

    /** @var array<string, string> */
    public const GROUPS = [
        self::INITIAL_CONSULTATION => self::GROUP_PRE_ENGAGEMENT,
        self::PROFILE_REVIEW => self::GROUP_PRE_ENGAGEMENT,
        self::ELIGIBILITY_ASSESSMENT => self::GROUP_PRE_ENGAGEMENT,
        self::PATHWAY_RECOMMENDED => self::GROUP_PRE_ENGAGEMENT,
        self::PATHWAY_SELECTED => self::GROUP_PRE_ENGAGEMENT,
        self::RETAINER_PENDING => self::GROUP_PRE_ENGAGEMENT,
        self::REPRESENTATIVE_AUTHORIZATION_PENDING => self::GROUP_PRE_ENGAGEMENT,
        self::CASE_ACTIVE => self::GROUP_ACTIVE_CASE,
        self::ADDITIONAL_DATA_COLLECTION => self::GROUP_ACTIVE_CASE,
        self::DOCUMENT_COLLECTION => self::GROUP_ACTIVE_CASE,
        self::DOCUMENT_REVIEW => self::GROUP_ACTIVE_CASE,
        self::APPLICATION_PREPARATION => self::GROUP_ACTIVE_CASE,
        self::CONSULTANT_FINAL_REVIEW => self::GROUP_ACTIVE_CASE,
        self::CLIENT_REVIEW => self::GROUP_ACTIVE_CASE,
        self::READY_TO_SUBMIT => self::GROUP_ACTIVE_CASE,
        self::SUBMITTED => self::GROUP_POST_SUBMISSION,
        self::GOVERNMENT_PROCESSING => self::GROUP_POST_SUBMISSION,
        self::GOVERNMENT_REQUEST_RECEIVED => self::GROUP_POST_SUBMISSION,
        self::RESPONSE_IN_PROGRESS => self::GROUP_POST_SUBMISSION,
        self::DECISION_RECEIVED => self::GROUP_POST_SUBMISSION,
        self::CASE_CLOSED => self::GROUP_POST_SUBMISSION,
    ];

    /** @var array<string, string> */
    public const LEGACY_MAP = [
        'PENDING_ASSESSMENT' => self::ELIGIBILITY_ASSESSMENT,
        'PATHWAY_SELECTED' => self::PATHWAY_SELECTED,
        'AGREEMENT_SENT' => self::RETAINER_PENDING,
        'AGREEMENT_SIGNED' => self::CASE_ACTIVE,
        'DOCUMENTS_UPLOADING' => self::DOCUMENT_COLLECTION,
        'UNDER_REVIEW' => self::DOCUMENT_REVIEW,
        'READY_FOR_SUBMISSION' => self::READY_TO_SUBMIT,
        'APPLICATION_SUBMITTED' => self::SUBMITTED,
        'active' => self::ELIGIBILITY_ASSESSMENT,
    ];

    public static function isKnown(string $status): bool
    {
        return isset(self::ORDER[$status]) || isset(self::LEGACY_MAP[$status]);
    }

    public static function fromLegacy(?string $legacyStatus): string
    {
        if ($legacyStatus && isset(self::ORDER[$legacyStatus])) {
            return $legacyStatus;
        }

        if ($legacyStatus && isset(self::LEGACY_MAP[$legacyStatus])) {
            return self::LEGACY_MAP[$legacyStatus];
        }

        return self::ELIGIBILITY_ASSESSMENT;
    }

    public static function group(string $status): string
    {
        $resolved = self::fromLegacy($status);

        return self::GROUPS[$resolved] ?? self::GROUP_PRE_ENGAGEMENT;
    }

    public static function resolveForCase(?string $workflowStatus, ?string $legacyStatus): string
    {
        if ($workflowStatus && isset(self::ORDER[$workflowStatus])) {
            return $workflowStatus;
        }

        return self::fromLegacy($legacyStatus);
    }

    /** @var array<string, string> */
    public const LABELS = [
        self::INITIAL_CONSULTATION => 'Initial consultation',
        self::PROFILE_REVIEW => 'Profile review',
        self::ELIGIBILITY_ASSESSMENT => 'Eligibility assessment',
        self::PATHWAY_RECOMMENDED => 'Pathway recommended',
        self::PATHWAY_SELECTED => 'Pathway selected',
        self::RETAINER_PENDING => 'Retainer pending',
        self::REPRESENTATIVE_AUTHORIZATION_PENDING => 'Representative authorization',
        self::CASE_ACTIVE => 'Case active',
        self::ADDITIONAL_DATA_COLLECTION => 'Additional data collection',
        self::DOCUMENT_COLLECTION => 'Document collection',
        self::DOCUMENT_REVIEW => 'Document review',
        self::APPLICATION_PREPARATION => 'Application preparation',
        self::CONSULTANT_FINAL_REVIEW => 'Consultant final review',
        self::CLIENT_REVIEW => 'Client final review',
        self::READY_TO_SUBMIT => 'Ready to submit',
        self::SUBMITTED => 'Submitted',
        self::GOVERNMENT_PROCESSING => 'Government processing',
        self::GOVERNMENT_REQUEST_RECEIVED => 'Government request received',
        self::RESPONSE_IN_PROGRESS => 'Response in progress',
        self::DECISION_RECEIVED => 'Decision received',
        self::CASE_CLOSED => 'Case closed',
    ];

    public static function label(string $status): string
    {
        $resolved = self::fromLegacy($status);

        return self::LABELS[$resolved] ?? str_replace('_', ' ', strtolower($resolved));
    }

    /**
     * @return array{status: string, group: string, label: string, legacy_status: ?string, groups: array<string, string>}
     */
    public static function serialize(?string $workflowStatus, ?string $legacyStatus): array
    {
        $resolved = self::resolveForCase($workflowStatus, $legacyStatus);

        return [
            'status' => $resolved,
            'group' => self::group($resolved),
            'label' => self::label($resolved),
            'legacy_status' => $legacyStatus,
            'groups' => [
                self::GROUP_PRE_ENGAGEMENT => 'Pre-Engagement / Assessment',
                self::GROUP_ACTIVE_CASE => 'Active Case / Application Preparation',
                self::GROUP_POST_SUBMISSION => 'Submission / Post-Submission',
            ],
        ];
    }
}
