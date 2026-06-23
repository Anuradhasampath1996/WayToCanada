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

    public function onPaymentSucceeded(User $user, SubscriptionPaymentRecord $record, string $productName): void
    {
        $dedupeKey = 'billing_payment_success:' . ($record->stripe_invoice_id
            ?? $record->stripe_checkout_session_id
            ?? ('record:' . $record->id));

        if ($this->alreadySent($user, $dedupeKey)) {
            return;
        }

        $amount   = number_format((float) $record->total, 2);
        $currency = strtoupper($record->currency ?? 'CAD');
        $isRenewal = $record->payment_type === SubscriptionPaymentRecord::TYPE_RENEWAL;

        $title = $isRenewal ? 'Subscription renewed successfully' : 'Payment received';
        $body  = $isRenewal
            ? "Your automatic renewal for \"{$productName}\" was successful. Amount charged: {$amount} {$currency}."
            : "Your payment for \"{$productName}\" was successful. Amount charged: {$amount} {$currency}.";

        $this->notifications->dispatch(
            $user,
            NotificationType::SUBSCRIPTION_PAYMENT_SUCCEEDED,
            $title,
            $body,
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
        $dedupeKey ??= 'billing_renewal_failed:' . md5($user->id . '|' . $productName . '|' . now()->format('Y-m-d'));

        if ($this->alreadySent($user, $dedupeKey)) {
            return;
        }

        $this->notifications->dispatch(
            $user,
            NotificationType::SUBSCRIPTION_RENEWAL_FAILED,
            'Automatic renewal failed',
            "We could not renew \"{$productName}\" automatically. Please update your payment method in Billing to keep your access active.",
            NotificationUrlBuilder::consultantBilling(),
            $dedupeKey,
            $related,
        );
    }

    public function notifyStripeRenewalFailed(object $invoice, object $stripeSub): void
    {
        $invoiceId = $invoice->id ?? null;
        $type      = $stripeSub->metadata->type ?? '';
        $dedupeKey = $invoiceId ? 'billing_renewal_failed:stripe:' . $invoiceId : null;

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

    private function alreadySent(User $user, string $dedupeKey): bool
    {
        return UserNotification::where('user_id', $user->id)
            ->where('dedupe_key', $dedupeKey)
            ->exists();
    }
}
