<?php

namespace App\Services\Referral;

use App\Models\ConsultantReferral;
use App\Models\User;

class ReferralLifecycleService
{
    public function __construct(
        private ReferralNotificationService $notifications,
        private ReferralRiskService $risk,
        private ReferralAuditService $audit,
    ) {}

    public function onLicenseVerified(User $user): void
    {
        $referral = ConsultantReferral::query()
            ->with(['referrer', 'referred'])
            ->where('referred_user_id', $user->id)
            ->first();

        if (! $referral) {
            return;
        }

        if (in_array($referral->status, [
            ConsultantReferral::STATUS_SUBSCRIBED,
            ConsultantReferral::STATUS_REJECTED,
        ], true)) {
            return;
        }

        if ($user->rcic_number && $referral->referrer?->rcic_number
            && strcasecmp((string) $user->rcic_number, (string) $referral->referrer->rcic_number) === 0) {
            $flag = $this->risk->flagSameRcic($referral, (string) $user->rcic_number);
            $this->notifications->highRisk($flag);
            $this->audit->record('same_rcic_blocked', 'consultant_referral', $referral->id, [
                'status' => $referral->status,
            ], ['status' => ConsultantReferral::STATUS_REJECTED]);
            $referral->update(['status' => ConsultantReferral::STATUS_REJECTED]);

            return;
        }

        if ($user->rcic_number) {
            $duplicate = User::query()
                ->where('rcic_number', $user->rcic_number)
                ->where('id', '!=', $user->id)
                ->where('is_license_verified', true)
                ->exists();
            if ($duplicate) {
                $this->risk->flag('duplicate_rcic_number', 'review', $referral, $user, [
                    'rcic_number' => $user->rcic_number,
                    'note' => 'Application-level uniqueness only until a data audit confirms a safe unique index.',
                ]);
            }
        }

        if ($referral->status !== ConsultantReferral::STATUS_REGISTERED
            && $referral->status !== ConsultantReferral::STATUS_TRIAL_STARTED) {
            return;
        }

        $from = $referral->status;
        $referral->update(['status' => ConsultantReferral::STATUS_RCIC_VERIFIED]);
        $this->audit->record('referral_rcic_verified', 'consultant_referral', $referral->id, [
            'status' => $from,
        ], ['status' => ConsultantReferral::STATUS_RCIC_VERIFIED]);
        $this->notifications->referralVerified($referral->fresh(['referrer', 'referred']));
    }

    public function onTrialStarted(User $user): void
    {
        $referral = ConsultantReferral::query()->where('referred_user_id', $user->id)->first();
        if (! $referral) {
            return;
        }

        if (in_array($referral->status, [
            ConsultantReferral::STATUS_SUBSCRIBED,
            ConsultantReferral::STATUS_REJECTED,
        ], true)) {
            return;
        }

        $from = $referral->status;
        $referral->update(['status' => ConsultantReferral::STATUS_TRIAL_STARTED]);
        $this->audit->record('referral_trial_started', 'consultant_referral', $referral->id, [
            'status' => $from,
        ], ['status' => ConsultantReferral::STATUS_TRIAL_STARTED]);
    }
}
