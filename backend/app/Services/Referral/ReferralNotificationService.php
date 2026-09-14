<?php

namespace App\Services\Referral;

use App\Enums\NotificationType;
use App\Models\ConsultantReferral;
use App\Models\ConsultantWithdrawalRequest;
use App\Models\ReferralReward;
use App\Models\ReferralRiskFlag;
use App\Models\User;
use App\Services\Notifications\NotificationService;

class ReferralNotificationService
{
    public function __construct(private NotificationService $notifications) {}

    public function referralRegistered(ConsultantReferral $referral): void
    {
        $referrer = $referral->referrer;
        if (! $referrer) {
            return;
        }

        $first = $this->firstName($referral->referred);
        $this->notifications->dispatch(
            $referrer,
            NotificationType::REFERRAL_REGISTERED,
            'A colleague registered with your link',
            "{$first} created a consultant account using your referral link. A reward is earned only after their first eligible paid platform subscription.",
            $this->referralsUrl(),
            'referral-registered:'.$referral->id,
            $referral,
        );
    }

    public function referralVerified(ConsultantReferral $referral): void
    {
        $referrer = $referral->referrer;
        if (! $referrer) {
            return;
        }

        $first = $this->firstName($referral->referred);
        $this->notifications->dispatch(
            $referrer,
            NotificationType::REFERRAL_VERIFIED,
            'Your referral completed RCIC verification',
            "{$first} verified their RCIC licence. No reward is created until they complete a first eligible paid platform subscription.",
            $this->referralsUrl(),
            'referral-verified:'.$referral->id,
            $referral,
        );
    }

    public function rewardPending(ReferralReward $reward): void
    {
        $referrer = $reward->referrer;
        if (! $referrer) {
            return;
        }

        $amount = number_format((float) $reward->reward_amount_snapshot, 2);
        $this->notifications->dispatch(
            $referrer,
            NotificationType::REFERRAL_QUALIFIED,
            'Referral subscription qualified',
            "A referred consultant completed their first eligible paid platform subscription. CAD {$amount} is pending for the hold period.",
            $this->referralsUrl(),
            'referral-qualified:'.$reward->id,
            $reward,
        );
        $this->notifications->dispatch(
            $referrer,
            NotificationType::REFERRAL_REWARD_PENDING,
            'Referral reward pending',
            "CAD {$amount} will become available after the hold period if the payment is not refunded or disputed.",
            $this->referralsUrl(),
            'referral-reward-pending:'.$reward->id,
            $reward,
        );
    }

    public function rewardAvailable(ReferralReward $reward): void
    {
        $referrer = $reward->referrer;
        if (! $referrer) {
            return;
        }

        $amount = number_format((float) $reward->reward_amount_snapshot, 2);
        $this->notifications->dispatch(
            $referrer,
            NotificationType::REFERRAL_REWARD_AVAILABLE,
            'Referral reward available',
            "CAD {$amount} is now available in your RCICMaster wallet.",
            $this->referralsUrl(),
            'referral-reward-available:'.$reward->id,
            $reward,
        );
    }

    public function rewardReversed(ReferralReward $reward, string $reason): void
    {
        $referrer = $reward->referrer;
        if (! $referrer) {
            return;
        }

        $amount = number_format((float) $reward->reward_amount_snapshot, 2);
        $this->notifications->dispatch(
            $referrer,
            NotificationType::REFERRAL_REWARD_REVERSED,
            'Referral reward reversed',
            "CAD {$amount} was reversed because the qualifying payment was {$reason}. This does not create another reward chance.",
            $this->referralsUrl(),
            'referral-reward-reversed:'.$reward->id.':'.$reason,
            $reward,
        );
    }

    public function withdrawalRequested(ConsultantWithdrawalRequest $request): void
    {
        $user = $request->user;
        if ($user) {
            $amount = number_format((float) $request->amount, 2);
            $this->notifications->dispatch(
                $user,
                NotificationType::REFERRAL_WITHDRAWAL_REQUESTED,
                'Withdrawal requested',
                "Your withdrawal request for CAD {$amount} is waiting for admin review.",
                $this->referralsUrl('withdrawals'),
                'withdrawal-requested:'.$request->id,
                $request,
            );
        }

        $amount = number_format((float) $request->amount, 2);
        foreach ($this->admins() as $admin) {
            $this->notifications->dispatch(
                $admin,
                NotificationType::REFERRAL_ADMIN_WITHDRAWAL,
                'New referral withdrawal request',
                ($user?->name ?? 'A consultant')." requested CAD {$amount}.",
                $this->adminWithdrawalsUrl(),
                'admin-withdrawal:'.$request->id.':'.$admin->id,
                $request,
            );
        }
    }

    public function withdrawalStatus(ConsultantWithdrawalRequest $request, NotificationType $type, string $title, string $body): void
    {
        $user = $request->user;
        if (! $user) {
            return;
        }

        $this->notifications->dispatch(
            $user,
            $type,
            $title,
            $body,
            $this->referralsUrl('withdrawals'),
            $type->value.':'.$request->id,
            $request,
        );
    }

    public function highRisk(ReferralRiskFlag $flag): void
    {
        foreach ($this->admins() as $admin) {
            $this->notifications->dispatch(
                $admin,
                NotificationType::REFERRAL_ADMIN_RISK,
                'Referral review needed',
                'A high-risk referral signal needs review: '.$flag->code.'.',
                $this->adminReviewUrl(),
                'admin-risk:'.$flag->id.':'.$admin->id,
                $flag,
            );
        }
    }

    private function firstName(?User $user): string
    {
        if (! $user) {
            return 'A consultant';
        }

        $name = trim((string) $user->name);

        return $name === '' ? 'A consultant' : (explode(' ', $name)[0] ?? 'A consultant');
    }

    private function referralsUrl(string $tab = 'overview'): string
    {
        return rtrim((string) env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/')
            .'/dashboard/referrals?tab='.$tab;
    }

    private function adminWithdrawalsUrl(): string
    {
        return rtrim((string) env('ADMIN_DASHBOARD_URL', 'http://localhost:3001'), '/')
            .'/admindashboard/referral-program/withdrawals';
    }

    private function adminReviewUrl(): string
    {
        return rtrim((string) env('ADMIN_DASHBOARD_URL', 'http://localhost:3001'), '/')
            .'/admindashboard/referral-program/review';
    }

    /** @return list<User> */
    private function admins(): array
    {
        return User::query()->role(['admin', 'super-admin'])->get()->all();
    }
}
