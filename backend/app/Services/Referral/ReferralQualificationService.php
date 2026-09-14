<?php

namespace App\Services\Referral;

use App\Models\ConsultantReferral;
use App\Models\ConsultantWalletTransaction;
use App\Models\ReferralReward;
use App\Models\SubscriptionPaymentRecord;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ReferralQualificationService
{
    public function __construct(
        private ReferralSettingsService $settings,
        private ConsultantWalletLedgerService $ledger,
        private ReferralNotificationService $notifications,
        private ReferralAuditService $audit,
        private ReferralRiskService $risk,
    ) {}

    public function onPlatformPaymentRecorded(SubscriptionPaymentRecord $payment): ?ReferralReward
    {
        try {
            return $this->qualify($payment);
        } catch (\Throwable $e) {
            Log::warning('[Referral] Qualification failed', [
                'payment_id' => $payment->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function qualify(SubscriptionPaymentRecord $payment): ?ReferralReward
    {
        if (! $this->isEligiblePayment($payment)) {
            return null;
        }

        $rule = $this->settings->current();
        if (! $rule->program_enabled) {
            return null;
        }

        $eligibleIds = $rule->eligible_package_ids;
        if (is_array($eligibleIds) && $eligibleIds !== [] && $payment->subscription_package_id) {
            if (! in_array((int) $payment->subscription_package_id, array_map('intval', $eligibleIds), true)) {
                return null;
            }
        }

        return DB::connection('cws')->transaction(function () use ($payment, $rule) {
            $referral = ConsultantReferral::query()
                ->where('referred_user_id', $payment->user_id)
                ->lockForUpdate()
                ->first();

            if (! $referral) {
                return null;
            }

            if ($referral->status === ConsultantReferral::STATUS_REJECTED) {
                return null;
            }

            if ($referral->qualified_at || $referral->reward_created_at) {
                return $referral->reward;
            }

            if (ReferralReward::query()->where('referred_user_id', $payment->user_id)->exists()) {
                return ReferralReward::query()->where('referred_user_id', $payment->user_id)->first();
            }

            $referral->load(['referred', 'referrer']);
            $referred = $referral->referred;
            if (! $referred || ! $referred->is_license_verified) {
                return null;
            }

            if ($referred->rcic_number && $referral->referrer?->rcic_number
                && strcasecmp((string) $referred->rcic_number, (string) $referral->referrer->rcic_number) === 0) {
                $this->risk->flagSameRcic($referral, (string) $referred->rcic_number);

                return null;
            }

            $paidAt = $payment->paid_at ?? now();
            $holdDays = (int) $rule->hold_days;
            $availableAt = $paidAt->copy()->addDays($holdDays);

            $referral->update([
                'status' => ConsultantReferral::STATUS_SUBSCRIBED,
                'qualified_at' => $paidAt,
                'qualifying_subscription_id' => $payment->consultant_subscription_id,
                'qualifying_payment_record_id' => $payment->id,
                'qualifying_stripe_invoice_id' => $payment->stripe_invoice_id,
                'reward_created_at' => now(),
            ]);

            $reward = ReferralReward::query()->create([
                'referral_id' => $referral->id,
                'referred_user_id' => $referral->referred_user_id,
                'referrer_user_id' => $referral->referrer_user_id,
                'reward_rule_id' => $rule->id,
                'reward_rule_version' => $rule->version,
                'reward_amount_snapshot' => $rule->reward_value,
                'hold_days_snapshot' => $holdDays,
                'currency' => 'CAD',
                'status' => ReferralReward::STATUS_PENDING,
                'reward_available_at' => $availableAt,
                'qualifying_payment_record_id' => $payment->id,
                'qualifying_stripe_invoice_id' => $payment->stripe_invoice_id,
            ]);

            $wallet = $this->ledger->forUser($referral->referrer);
            $this->ledger->post(
                $wallet,
                ConsultantWalletTransaction::TYPE_REWARD_PENDING,
                'credit',
                (float) $rule->reward_value,
                'reward_pending:'.$reward->id,
                'Referral reward pending hold',
                ReferralReward::class,
                $reward->id,
                ['from' => 'pending'],
            );

            $this->audit->record('referral_qualified', 'referral_reward', $reward->id, null, [
                'amount' => (float) $rule->reward_value,
                'rule_version' => $rule->version,
                'payment_id' => $payment->id,
            ]);

            $this->notifications->rewardPending($reward->fresh(['referrer']));

            return $reward;
        });
    }

    public function isEligiblePayment(SubscriptionPaymentRecord $payment): bool
    {
        if ($payment->payment_category !== SubscriptionPaymentRecord::CATEGORY_SUBSCRIPTION) {
            return false;
        }

        if ($payment->payment_type !== SubscriptionPaymentRecord::TYPE_INITIAL) {
            return false;
        }

        if ($payment->payment_status !== SubscriptionPaymentRecord::STATUS_PAID) {
            return false;
        }

        if ((float) $payment->total <= 0) {
            return false;
        }

        $currency = strtoupper((string) ($payment->currency ?: 'CAD'));
        if ($currency !== 'CAD') {
            return false;
        }

        return true;
    }
}
