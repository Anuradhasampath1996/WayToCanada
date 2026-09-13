<?php

namespace App\Services\Notifications;

use App\Enums\NotificationType;
use App\Models\ConsultantMarketingOrder;
use App\Models\ConsultantStorageAddon;
use App\Models\ConsultantSubscription;
use App\Models\SubscriptionPaymentRecord;
use App\Models\User;
use App\Models\UserNotification;
use App\Support\NotificationUrlBuilder;
use Illuminate\Database\Eloquent\Model;

class ConsultantBillingNotificationService
{
    public function __construct(
        private NotificationService $notifications,
    ) {}

    public function notifyInvoicePaid(
        User $user,
        SubscriptionPaymentRecord $record,
        string $productName,
        bool $wasPastDue = false,
    ): void {
        if ($wasPastDue || $record->payment_type === SubscriptionPaymentRecord::TYPE_RECOVERY) {
            $this->onRenewalRecovered($user, $record, $productName);

            return;
        }

        if ($record->payment_type === SubscriptionPaymentRecord::TYPE_RENEWAL) {
            $this->onRenewed($user, $record, $productName);

            return;
        }

        $this->onPaymentSucceeded($user, $record, $productName);
    }

    public function onPaymentSucceeded(User $user, SubscriptionPaymentRecord $record, string $productName): void
    {
        $invoiceKey = $record->stripe_invoice_id
            ? 'billing_payment_success:'.$record->stripe_invoice_id
            : null;
        $sessionKey = $record->stripe_checkout_session_id
            ? 'billing_payment_success:'.$record->stripe_checkout_session_id
            : null;
        $dedupeKey = $invoiceKey ?? $sessionKey ?? ('billing_payment_success:record:'.$record->id);

        if ($this->alreadySent($user, $dedupeKey)
            || ($invoiceKey && $this->alreadySent($user, $invoiceKey))
            || ($sessionKey && $this->alreadySent($user, $sessionKey))) {
            return;
        }

        $amount   = number_format((float) $record->total, 2);
        $currency = strtoupper($record->currency ?? 'CAD');

        $this->notifications->dispatch(
            $user,
            NotificationType::SUBSCRIPTION_PAYMENT_SUCCEEDED,
            'Payment received',
            "Your payment for \"{$productName}\" was successful. Amount charged: {$amount} {$currency}.",
            NotificationUrlBuilder::consultantBilling(),
            $dedupeKey,
            $record,
        );
    }

    public function onRenewed(User $user, SubscriptionPaymentRecord $record, string $productName): void
    {
        $dedupeKey = 'billing_renewal_success:'.($record->stripe_invoice_id ?? ('record:'.$record->id));
        if ($this->alreadySent($user, $dedupeKey)
            || ($record->stripe_invoice_id && $this->alreadySent($user, 'billing_payment_success:'.$record->stripe_invoice_id))) {
            return;
        }

        $amount   = number_format((float) $record->total, 2);
        $currency = strtoupper($record->currency ?? 'CAD');

        $this->notifications->dispatch(
            $user,
            NotificationType::SUBSCRIPTION_RENEWED,
            'Subscription renewed successfully',
            "Your automatic renewal for \"{$productName}\" was successful. Amount charged: {$amount} {$currency}.",
            NotificationUrlBuilder::consultantBilling(),
            $dedupeKey,
            $record,
        );
    }

    public function onRenewalRecovered(User $user, SubscriptionPaymentRecord $record, string $productName): void
    {
        $dedupeKey = 'billing_renewal_recovered:'.($record->stripe_invoice_id ?? ('record:'.$record->id));
        if ($this->alreadySent($user, $dedupeKey)) {
            return;
        }

        $amount   = number_format((float) $record->total, 2);
        $currency = strtoupper($record->currency ?? 'CAD');

        $this->notifications->dispatch(
            $user,
            NotificationType::SUBSCRIPTION_RENEWAL_RECOVERED,
            'Subscription payment recovered',
            "Your payment for \"{$productName}\" succeeded after a failed renewal. Amount charged: {$amount} {$currency}. Access is active again.",
            NotificationUrlBuilder::consultantBilling(),
            $dedupeKey,
            $record,
        );
    }

    public function onRenewalFailed(
        User $user,
        string $productName,
        ?Model $related = null,
        ?string $dedupeKey = null,
    ): void {
        $dedupeKey ??= 'billing_renewal_failed:'.md5($user->id.'|'.$productName.'|'.now()->format('Y-m-d'));

        if ($this->alreadySent($user, $dedupeKey)) {
            return;
        }

        $this->notifications->dispatch(
            $user,
            NotificationType::SUBSCRIPTION_RENEWAL_FAILED,
            'Automatic renewal failed',
            "We could not renew \"{$productName}\" automatically. Open Billing and choose Update payment method to add a card on Stripe’s secure page. You keep workspace access during the grace period.",
            NotificationUrlBuilder::consultantBilling(),
            $dedupeKey,
            $related,
        );
    }

    public function notifyStripeRenewalFailed(object $invoice, object $stripeSub): void
    {
        $invoiceId = $invoice->id ?? null;
        $type      = $stripeSub->metadata->type ?? '';
        $dedupeKey = $invoiceId ? 'billing_renewal_failed:stripe:'.$invoiceId : null;

        if ($type === 'marketing_service') {
            $order = ConsultantMarketingOrder::where('stripe_subscription_id', $stripeSub->id)
                ->with('user', 'service:id,name')
                ->first();
            if ($order?->user) {
                $this->onRenewalFailed(
                    $order->user,
                    $order->service?->name ?? 'Marketing service',
                    $order,
                    $dedupeKey,
                );
            }

            return;
        }

        if ($type === 'storage_addon') {
            $addon = ConsultantStorageAddon::where('stripe_subscription_id', $stripeSub->id)
                ->with('user', 'package:id,name')
                ->first();
            if ($addon?->user) {
                $this->onRenewalFailed(
                    $addon->user,
                    $addon->package?->name ?? 'Storage add-on',
                    $addon,
                    $dedupeKey,
                );
            }

            return;
        }

        $subscription = ConsultantSubscription::where('stripe_subscription_id', $stripeSub->id)
            ->with('user', 'package:id,name')
            ->first();

        if ($subscription?->user) {
            $this->onRenewalFailed(
                $subscription->user,
                $subscription->package?->name ?? 'Platform subscription',
                $subscription,
                $dedupeKey,
            );
        }
    }

    public function onCancellationScheduled(User $user, ConsultantSubscription $subscription, string $productName): void
    {
        $periodEnd = $subscription->ends_at?->toDateString() ?? 'period end';
        $dedupeKey = 'billing_cancel_scheduled:'.$subscription->id.':'.$periodEnd;
        if ($this->alreadySent($user, $dedupeKey)) {
            return;
        }

        $this->notifications->dispatch(
            $user,
            NotificationType::SUBSCRIPTION_CANCELLATION_SCHEDULED,
            'Cancellation scheduled',
            "Automatic renewal for \"{$productName}\" is off. You keep access until {$periodEnd}. You can turn renewal back on before then.",
            NotificationUrlBuilder::consultantBilling(),
            $dedupeKey,
            $subscription,
        );
    }

    public function onCancelled(User $user, string $productName, ConsultantSubscription $subscription, ?string $dedupeKey = null): void
    {
        $dedupeKey ??= 'billing_cancelled:'.$subscription->id;
        if ($this->alreadySent($user, $dedupeKey)) {
            return;
        }

        $this->notifications->dispatch(
            $user,
            NotificationType::SUBSCRIPTION_CANCELLED,
            'Subscription cancelled',
            "Your \"{$productName}\" subscription is no longer active.",
            NotificationUrlBuilder::consultantBilling(),
            $dedupeKey,
            $subscription,
        );
    }

    private function alreadySent(User $user, string $dedupeKey): bool
    {
        return UserNotification::where('user_id', $user->id)
            ->where('dedupe_key', $dedupeKey)
            ->exists();
    }
}
