<?php

namespace App\Services\Referral;

use App\Contracts\StripePlatformClient;
use App\Models\ConsultantSubscription;
use App\Models\ConsultantWalletTransaction;
use App\Models\SubscriptionPaymentRecord;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Phase 6 — invoice-specific platform renewal credit.
 *
 * Stripe lifecycle used here (re-validated 2026-09-14 against current Stripe invoice events):
 * - invoice.upcoming is a preview only and has no persistent invoice id, so it cannot receive items.
 * - invoice.created is the mutable draft window. Invoice items can be attached only while status=draft.
 * - invoice.finalized / automatic collection can charge immediately after finalize, so we never apply after that.
 * - invoice.paid is the only finalize point for local wallet application.
 * - invoice.voided / failed attach releases the local reservation.
 *
 * v1 rules: renewal-only, this invoice only, post-tax cash reduction, no Stripe customer balance,
 * isolated from marketing/storage, reserved locally first, idempotent.
 */
class WalletSubscriptionCreditService
{
    public function __construct(
        private ReferralSettingsService $settings,
        private ConsultantWalletLedgerService $ledger,
        private ReferralAuditService $audit,
    ) {}

    public function onInvoiceCreated(object $invoice): void
    {
        if (! $this->isPlatformRenewalInvoice($invoice)) {
            return;
        }

        $status = (string) ($invoice->status ?? '');
        if ($status !== '' && $status !== 'draft') {
            Log::info('[WalletCredit] Skipping non-draft invoice', [
                'invoice' => $invoice->id ?? null,
                'status' => $status,
            ]);

            return;
        }

        $user = $this->userForInvoice($invoice);
        if (! $user) {
            return;
        }

        $rule = $this->settings->current();
        if (! $rule->wallet_credit_enabled) {
            return;
        }

        $wallet = $this->ledger->forUser($user);
        if (! $wallet->auto_use_wallet_on_renewal) {
            return;
        }

        $invoiceId = (string) ($invoice->id ?? '');
        if ($invoiceId === '' || ! str_starts_with($invoiceId, 'in_')) {
            return;
        }

        $existing = ConsultantWalletTransaction::query()
            ->where('idempotency_key', $this->reserveKey($invoiceId))
            ->first();
        if ($existing) {
            return;
        }

        $amountDue = $this->amountDueCad($invoice);
        $spendable = $this->ledger->spendable($wallet);
        $credit = round(min($spendable, $amountDue), 2);
        if ($credit <= 0) {
            return;
        }

        $this->ledger->post(
            $wallet,
            ConsultantWalletTransaction::TYPE_SUB_CREDIT_RESERVED,
            'debit',
            $credit,
            $this->reserveKey($invoiceId),
            'Wallet credit reserved for platform renewal',
            'stripe_invoice',
            null,
            ['stripe_invoice_id' => $invoiceId, 'amount_due' => $amountDue],
        );

        try {
            $item = app(StripePlatformClient::class)->createInvoiceCreditItem(
                (string) $invoice->customer,
                $invoiceId,
                $credit,
                'RCICMaster wallet credit'
            );
            $this->audit->record('wallet_credit_reserved', 'stripe_invoice', null, null, [
                'invoice' => $invoiceId,
                'amount' => $credit,
                'invoice_item' => $item->id ?? null,
            ]);
        } catch (\Throwable $e) {
            Log::warning('[WalletCredit] Could not attach invoice item; releasing reservation', [
                'invoice' => $invoiceId,
                'error' => $e->getMessage(),
            ]);
            $this->release($user, $invoiceId, 'attach_failed');
        }
    }

    public function onInvoicePaid(object $invoice, ?SubscriptionPaymentRecord $payment = null): void
    {
        if (! $this->isPlatformInvoice($invoice)) {
            return;
        }

        $invoiceId = (string) ($invoice->id ?? '');
        $reserved = ConsultantWalletTransaction::query()
            ->where('idempotency_key', $this->reserveKey($invoiceId))
            ->first();
        if (! $reserved) {
            return;
        }

        $user = User::query()->find($reserved->user_id);
        if (! $user) {
            return;
        }

        $wallet = $this->ledger->forUser($user);
        $this->ledger->post(
            $wallet,
            ConsultantWalletTransaction::TYPE_SUB_CREDIT_APPLIED,
            'debit',
            (float) $reserved->amount,
            $this->appliedKey($invoiceId),
            'Wallet credit applied to platform renewal',
            'stripe_invoice',
            $payment?->id,
            ['stripe_invoice_id' => $invoiceId],
        );

        if ($payment) {
            $payment->forceFill([
                'wallet_credit_amount' => (float) $reserved->amount,
            ])->save();
        }

        $this->audit->record('wallet_credit_applied', 'stripe_invoice', $payment?->id, null, [
            'invoice' => $invoiceId,
            'amount' => (float) $reserved->amount,
        ]);
    }

    public function onInvoiceVoided(object $invoice): void
    {
        $invoiceId = (string) ($invoice->id ?? '');
        if ($invoiceId === '') {
            return;
        }

        $reserved = ConsultantWalletTransaction::query()
            ->where('idempotency_key', $this->reserveKey($invoiceId))
            ->first();
        if (! $reserved) {
            return;
        }

        $user = User::query()->find($reserved->user_id);
        if ($user) {
            $this->release($user, $invoiceId, 'voided');
        }
    }

    public function finalizeFromPayment(SubscriptionPaymentRecord $payment, object $invoice): void
    {
        if ($payment->payment_category !== SubscriptionPaymentRecord::CATEGORY_SUBSCRIPTION) {
            return;
        }

        $this->onInvoicePaid($invoice, $payment);
    }

    private function release(User $user, string $invoiceId, string $reason): void
    {
        $reserved = ConsultantWalletTransaction::query()
            ->where('idempotency_key', $this->reserveKey($invoiceId))
            ->first();
        if (! $reserved) {
            return;
        }

        $wallet = $this->ledger->forUser($user);
        $this->ledger->post(
            $wallet,
            ConsultantWalletTransaction::TYPE_SUB_CREDIT_RELEASED,
            'credit',
            (float) $reserved->amount,
            $this->releaseKey($invoiceId),
            'Wallet credit reservation released ('.$reason.')',
            'stripe_invoice',
            null,
            ['stripe_invoice_id' => $invoiceId, 'reason' => $reason],
        );
    }

    private function isPlatformRenewalInvoice(object $invoice): bool
    {
        if (! $this->isPlatformInvoice($invoice)) {
            return false;
        }

        $reason = (string) ($invoice->billing_reason ?? '');

        return in_array($reason, ['subscription_cycle', 'subscription_update', 'subscription_threshold'], true);
    }

    private function isPlatformInvoice(object $invoice): bool
    {
        $stripeSubId = $invoice->subscription ?? null;
        if (! $stripeSubId) {
            return false;
        }

        try {
            $stripeSub = app(StripePlatformClient::class)->retrieveSubscription((string) $stripeSubId);
        } catch (\Throwable) {
            return false;
        }

        $type = $stripeSub->metadata->type ?? '';
        if (in_array($type, ['marketing_service', 'storage_addon'], true)) {
            return false;
        }

        return ConsultantSubscription::query()
            ->where('stripe_subscription_id', is_object($stripeSub) ? $stripeSub->id : $stripeSub)
            ->exists();
    }

    private function userForInvoice(object $invoice): ?User
    {
        $stripeSubId = $invoice->subscription ?? null;
        if (! $stripeSubId) {
            return null;
        }

        $sub = ConsultantSubscription::query()
            ->where('stripe_subscription_id', (string) $stripeSubId)
            ->first();

        return $sub?->user;
    }

    private function amountDueCad(object $invoice): float
    {
        $amountDue = (int) ($invoice->amount_due ?? 0);

        return round($amountDue / 100, 2);
    }

    private function reserveKey(string $invoiceId): string
    {
        return 'subscription_credit_reserved:invoice:'.$invoiceId;
    }

    private function appliedKey(string $invoiceId): string
    {
        return 'subscription_credit_applied:invoice:'.$invoiceId;
    }

    private function releaseKey(string $invoiceId): string
    {
        return 'subscription_credit_released:invoice:'.$invoiceId;
    }
}
