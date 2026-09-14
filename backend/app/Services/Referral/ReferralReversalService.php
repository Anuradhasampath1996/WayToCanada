<?php

namespace App\Services\Referral;

use App\Models\ConsultantWalletTransaction;
use App\Models\ReferralReward;
use App\Models\SubscriptionPaymentRecord;
use Illuminate\Support\Facades\DB;

class ReferralReversalService
{
    public function __construct(
        private ConsultantWalletLedgerService $ledger,
        private ReferralNotificationService $notifications,
        private ReferralAuditService $audit,
        private ReferralRiskService $risk,
        private StripePaymentRecordResolver $resolver,
    ) {}

    public function reverseFromCharge(object $charge, string $reason = 'refunded'): ?ReferralReward
    {
        $payment = $this->resolver->fromCharge($charge);
        if (! $payment) {
            return null;
        }

        return $this->reverseFromPayment($payment, $reason);
    }

    public function reverseFromPayment(SubscriptionPaymentRecord $payment, string $reason = 'refunded'): ?ReferralReward
    {
        $reward = ReferralReward::query()
            ->with(['referrer', 'referral'])
            ->where(function ($q) use ($payment) {
                $q->where('qualifying_payment_record_id', $payment->id);
                if ($payment->stripe_invoice_id) {
                    $q->orWhere('qualifying_stripe_invoice_id', $payment->stripe_invoice_id);
                }
            })
            ->first();

        if (! $reward) {
            return null;
        }

        return $this->reverse($reward, $reason);
    }

    public function reverse(ReferralReward $reward, string $reason): ReferralReward
    {
        return DB::connection('cws')->transaction(function () use ($reward, $reason) {
            $locked = ReferralReward::query()->whereKey($reward->id)->lockForUpdate()->firstOrFail();

            if (in_array($locked->status, [
                ReferralReward::STATUS_REVERSED,
                ReferralReward::STATUS_CANCELLED,
                ReferralReward::STATUS_REJECTED,
            ], true)) {
                return $locked;
            }

            $fromStatus = $locked->status;
            $amount = (float) $locked->reward_amount_snapshot;
            $wallet = $this->ledger->forUser($locked->referrer);
            $wallet = $this->ledger->recompute($wallet);

            if ($fromStatus === ReferralReward::STATUS_PENDING) {
                $this->ledger->post(
                    $wallet,
                    ConsultantWalletTransaction::TYPE_REWARD_REVERSAL,
                    'debit',
                    $amount,
                    'reward_reversal:'.$locked->id.':'.$reason,
                    'Referral reward cancelled during hold ('.$reason.')',
                    ReferralReward::class,
                    $locked->id,
                    ['from' => 'pending', 'reason' => $reason],
                );
                $locked->update([
                    'status' => ReferralReward::STATUS_CANCELLED,
                    'reversed_at' => now(),
                ]);
            } else {
                $available = (float) $wallet->available_balance;
                $spendable = (float) $wallet->spendable_balance;
                $unused = min($amount, max(0, $spendable));
                $used = round($amount - $unused, 2);

                if ($unused > 0) {
                    $this->ledger->post(
                        $wallet,
                        ConsultantWalletTransaction::TYPE_REWARD_REVERSAL,
                        'debit',
                        $unused,
                        'reward_reversal:'.$locked->id.':'.$reason,
                        'Referral reward reversed ('.$reason.')',
                        ReferralReward::class,
                        $locked->id,
                        ['from' => 'available', 'reason' => $reason],
                    );
                }

                if ($used > 0) {
                    $this->ledger->post(
                        $wallet,
                        ConsultantWalletTransaction::TYPE_ADMIN_RECOVERY,
                        'debit',
                        $used,
                        'admin_recovery:'.$locked->id.':'.$reason,
                        'Recovery after withdrawn or applied reward ('.$reason.')',
                        ReferralReward::class,
                        $locked->id,
                        ['reason' => $reason, 'recovered' => $used],
                    );
                    $wallet->update(['withdrawals_frozen_at' => $wallet->withdrawals_frozen_at ?? now()]);
                    $this->risk->flag('reward_recovery', 'high', $locked->referral, $locked->referrer, [
                        'reward_id' => $locked->id,
                        'reason' => $reason,
                        'recovery_amount' => $used,
                    ]);
                }

                $locked->update([
                    'status' => ReferralReward::STATUS_REVERSED,
                    'reversed_at' => now(),
                ]);
            }

            $this->audit->record('reward_reversed', 'referral_reward', $locked->id, [
                'status' => $fromStatus,
            ], [
                'status' => $locked->status,
                'reason' => $reason,
            ]);

            $this->notifications->rewardReversed($locked->fresh(['referrer']), $reason);

            return $locked->fresh();
        });
    }
}
