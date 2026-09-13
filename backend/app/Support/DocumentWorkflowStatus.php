<?php

namespace App\Support;

/**
 * First-class document statuses (Phase 3) with legacy hub/AI mappings.
 */
final class DocumentWorkflowStatus
{
    public const REQUESTED = 'requested';
    public const UPLOADED = 'uploaded';
    public const UNDER_REVIEW = 'under_review';
    public const CORRECTION_REQUIRED = 'correction_required';
    public const RESUBMISSION_REQUESTED = 'resubmission_requested';
    public const VERIFIED = 'verified';

    /** @var array<string, string> */
    public const FROM_LEGACY = [
        'pending_review' => self::UNDER_REVIEW,
        'under_ai_review' => self::UNDER_REVIEW,
        'ai_flagged' => self::UNDER_REVIEW,
        'consultant_rejected' => self::CORRECTION_REQUIRED,
        'resubmission_requested' => self::RESUBMISSION_REQUESTED,
        'consultant_approved' => self::VERIFIED,
        'ai_verified' => self::VERIFIED,
        'missing' => self::REQUESTED,
        'requested' => self::REQUESTED,
        'uploaded' => self::UPLOADED,
        'under_review' => self::UNDER_REVIEW,
        'correction_required' => self::CORRECTION_REQUIRED,
        'verified' => self::VERIFIED,
    ];

    public static function canonicalize(?string $status): string
    {
        if (! $status) {
            return self::REQUESTED;
        }

        return self::FROM_LEGACY[$status] ?? $status;
    }

    public static function label(string $status): string
    {
        return match (self::canonicalize($status)) {
            self::REQUESTED => 'Requested',
            self::UPLOADED => 'Uploaded',
            self::UNDER_REVIEW => 'Under review',
            self::CORRECTION_REQUIRED => 'Correction required',
            self::RESUBMISSION_REQUESTED => 'Resubmission requested',
            self::VERIFIED => 'Verified',
            default => str_replace('_', ' ', $status),
        };
    }
}
