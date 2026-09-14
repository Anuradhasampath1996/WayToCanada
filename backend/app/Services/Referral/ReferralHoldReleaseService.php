<?php

namespace App\Services\Referral;

use App\Models\ConsultantWalletTransaction;
use App\Models\ReferralReward;
use Illuminate\Support\Facades\DB;

class ReferralHoldReleaseService
{
    public function __construct(
        private ConsultantWalletLedgerService $ledger,
        private ReferralNotificationService $notifications,
        private ReferralAuditService $audit,
    ) {}

    public function releaseDue(?int $limit = null): int
    {
        $query = ReferralReward::query()
            ->with('referrer')
            ->where('status', ReferralReward::STATUS_PENDING)
            ->whereNotNull('reward_available_at')
            ->where('reward_available_at', '<=', now());

        if ($limit) {
            $query->limit($limit);
        }

        $released = 0;
        foreach ($query->get() as $reward) {
            if ($this->release($reward)) {
                $released++;
            }
        }

        return $released;
    }

    public function release(ReferralReward $reward): bool
    {
        if ($reward->status !== ReferralReward::STATUS_PENDING) {
            return false;
        }

        if ($reward->reward_available_at && $reward->reward_available_at->isFuture()) {
            return false;
        }

        return (bool) DB::connection('cws')->transaction(function () use ($reward) {
            $locked = ReferralReward::query()->whereKey($reward->id)->lockForUpdate()->first();
            if (! $locked || $locked->status !== ReferralReward::STATUS_PENDING) {
                return false;
            }

            $locked->update([
                'status' => ReferralReward::STATUS_AVAILABLE,
                'available_at' => now(),
            ]);

            $wallet = $this->ledger->forUser($locked->referrer);
            $this->ledger->post(
                $wallet,
                ConsultantWalletTransaction::TYPE_REWARD_AVAILABLE,
                'credit',
                (float) $locked->reward_amount_snapshot,
                'reward_available:'.$locked->id,
                'Referral reward released after hold',
                ReferralReward::class,
                $locked->id,
            );

            $this->audit->record('reward_available', 'referral_reward', $locked->id, [
                'status' => ReferralReward::STATUS_PENDING,
            ], ['status' => ReferralReward::STATUS_AVAILABLE]);

            $this->notifications->rewardAvailable($locked->fresh(['referrer']));

            return true;
        });
    }
}
