<?php

namespace App\Services;

use App\Models\ConsultantMarketingOrder;
use App\Models\ConsultantStorageAddon;
use App\Models\ConsultantSubscription;
use App\Models\MarketingService;
use App\Models\StorageAddonPackage;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPaymentRecord;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Stripe\Checkout\Session as StripeSession;
use Stripe\Invoice as StripeInvoice;
use Stripe\Subscription as StripeSubscription;

class StripePaymentFulfillmentService
{
    public function __construct(
        private SubscriptionPaymentRecorder $recorder,
        private CanadianBillingTaxService $taxService,
        private ConsultantBillingNotificationService $billingNotifications,
    ) {}

    /** @return array<string, mixed>|null */
    public function fulfillCheckoutSession(object $session): ?array
    {
        if (($session->payment_status ?? '') !== 'paid' && ($session->status ?? '') !== 'complete') {
            return null;
        }

        $metadata = (array) ($session->metadata ?? []);
        $type     = $metadata['type'] ?? null;

        if (($session->mode ?? '') === 'payment') {
            if ($type === 'marketing_service') {
                return $this->fulfillMarketingCheckout($session);
            }

            return null;
        }

        if (($session->mode ?? '') === 'subscription') {
            if ($type === 'marketing_service') {
                return $this->fulfillMarketingCheckout($session);
            }
            if ($type === 'storage_addon') {
                return $this->fulfillStorageCheckout($session);
            }

            return $this->fulfillPlatformSubscriptionCheckout($session);
        }

        return null;
    }

    public function handleInvoicePaid(object $invoice): void
    {
        $stripeSubId = $invoice->subscription ?? null;
        if (! $stripeSubId) {
            return;
        }

        try {
            new StripeService();
            $stripeSub = StripeSubscription::retrieve($stripeSubId);
        } catch (\Throwable $e) {
            Log::warning('[Fulfillment] Could not retrieve subscription for invoice', [
                'subscription_id' => $stripeSubId,
                'error'           => $e->getMessage(),
            ]);

            return;
        }

        $type = $stripeSub->metadata->type ?? '';

        match ($type) {
            'marketing_service' => $this->handleMarketingInvoicePaid($invoice, $stripeSub),
            'storage_addon'     => $this->handleStorageInvoicePaid($invoice, $stripeSub),
            default             => $this->handlePlatformSubscriptionInvoicePaid($invoice, $stripeSub),
        };
    }

    public function handleSubscriptionUpdated(object $subscription): void
    {
        $type = $subscription->metadata->type ?? '';

        if ($type === 'marketing_service') {
            $this->handleMarketingSubscriptionChange($subscription);

            return;
        }

        if ($type === 'storage_addon') {
            $this->handleStorageSubscriptionChange($subscription);

            return;
        }

        $this->handlePlatformSubscriptionChange($subscription);
    }

    public function handleInvoicePaymentFailed(object $invoice): void
    {
        $stripeSubId = $invoice->subscription ?? null;
        if (! $stripeSubId) {
            return;
        }

        try {
            new StripeService();
            $stripeSub = StripeSubscription::retrieve($stripeSubId);
        } catch (\Throwable) {
            return;
        }

        $type = $stripeSub->metadata->type ?? '';

        if ($type === 'marketing_service') {
            ConsultantMarketingOrder::where('stripe_subscription_id', $stripeSubId)
                ->update(['status' => ConsultantMarketingOrder::STATUS_CANCELLED]);

            $this->billingNotifications->notifyStripeRenewalFailed($invoice, $stripeSub);

            return;
        }

        if ($type === 'storage_addon') {
            ConsultantStorageAddon::where('stripe_subscription_id', $stripeSubId)
                ->update(['status' => 'past_due']);

            $this->billingNotifications->notifyStripeRenewalFailed($invoice, $stripeSub);

            return;
        }

        ConsultantSubscription::where('stripe_subscription_id', $stripeSubId)
            ->update(['status' => 'past_due']);

        $this->billingNotifications->notifyStripeRenewalFailed($invoice, $stripeSub);
    }

    /** @return array<string, mixed> */
    public function fulfillPlatformSubscriptionCheckout(object $session, ?User $user = null): array
    {
        $existing = ConsultantSubscription::where('stripe_checkout_session_id', $session->id)->first();
        if ($existing) {
            return ['type' => 'subscription', 'subscription' => $existing, 'already' => true];
        }

        $metadata  = (array) ($session->metadata ?? []);
        $packageId = (int) ($metadata['subscription_package_id'] ?? 0);
        $cycle     = $metadata['billing_cycle'] ?? 'monthly';
        $userId    = (int) ($session->client_reference_id ?? $metadata['user_id'] ?? 0);
        $country   = $metadata['billing_country'] ?? 'CA';
        $province  = $metadata['province'] ?? null;

        if (! $packageId || ! $userId) {
            throw new \RuntimeException('Missing subscription checkout metadata.');
        }

        $user ??= User::findOrFail($userId);
        $session = $this->expandSession($session, ['subscription', 'invoice']);

        $stripeSub = $session->subscription;
        if (is_string($stripeSub)) {
            $stripeSub = StripeSubscription::retrieve($stripeSub);
        }

        $package = SubscriptionPackage::findOrFail($packageId);
        $endsAt  = $stripeSub?->current_period_end
            ? Carbon::createFromTimestamp($stripeSub->current_period_end)
            : ($cycle === 'yearly' ? now()->addYear() : now()->addMonth());

        $billingAddress = $this->billingAddressFromUser($user, $country, $province);

        ConsultantSubscription::where('user_id', $userId)
            ->whereIn('status', ['trial', 'active'])
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        $sub = ConsultantSubscription::create([
            'user_id'                    => $userId,
            'subscription_package_id'    => $package->id,
            'status'                     => 'active',
            'is_trial'                   => false,
            'trial_ends_at'              => null,
            'starts_at'                  => now(),
            'ends_at'                    => $endsAt,
            'billing_cycle'              => $cycle,
            'billing_country'            => $country,
            'billing_province'           => $province,
            'billing_address'            => $billingAddress,
            'last_payment_at'            => now(),
            'cancelled_at'               => null,
            'stripe_customer_id'         => $this->customerId($session),
            'stripe_subscription_id'     => is_object($stripeSub) ? $stripeSub->id : $stripeSub,
            'stripe_checkout_session_id' => $session->id,
        ]);

        $subtotal     = $cycle === 'yearly' ? (float) $package->yearly_price : (float) $package->monthly_price;
        $taxBreakdown = $this->taxService->quote($subtotal, $billingAddress);
        $stripeInvoice = $this->resolveInvoice($session->invoice);

        $payment = $this->recorder->recordFromCheckout(
            $sub,
            $user,
            $billingAddress,
            $taxBreakdown,
            SubscriptionPaymentRecord::TYPE_INITIAL,
            $session->id,
            is_object($stripeInvoice) ? ($stripeInvoice->id ?? null) : null,
            is_object($stripeInvoice) ? ($stripeInvoice->number ?? null) : null,
            is_object($stripeInvoice) ? ($stripeInvoice->invoice_pdf ?? null) : null,
            is_object($stripeInvoice) ? ($stripeInvoice->hosted_invoice_url ?? null) : null,
            $this->sessionSubtotal($session, $stripeInvoice),
            $this->sessionTax($session, $stripeInvoice),
            $this->sessionTotal($session, $stripeInvoice),
        );

        $this->billingNotifications->onPaymentSucceeded($user, $payment, $package->name);

        return ['type' => 'subscription', 'subscription' => $sub->load('package'), 'payment' => $payment];
    }

    /** @return array<string, mixed> */
    public function fulfillMarketingCheckout(object $session, ?User $user = null): array
    {
        $order = ConsultantMarketingOrder::where('stripe_checkout_session_id', $session->id)->first();

        if ($order && in_array($order->status, [ConsultantMarketingOrder::STATUS_PAID, ConsultantMarketingOrder::STATUS_ACTIVE], true)) {
            return ['type' => 'marketing', 'order' => $order->load('service'), 'already' => true];
        }

        $metadata  = (array) ($session->metadata ?? []);
        $serviceId = (int) ($metadata['marketing_service_id'] ?? 0);
        $userId    = (int) ($session->client_reference_id ?? $metadata['user_id'] ?? 0);
        $billingType = $metadata['billing_type'] ?? MarketingService::BILLING_ONE_TIME;

        if (! $serviceId || ! $userId) {
            throw new \RuntimeException('Missing marketing checkout metadata.');
        }

        $user ??= User::findOrFail($userId);
        $service = MarketingService::findOrFail($serviceId);

        if (! $order) {
            $order = ConsultantMarketingOrder::create([
                'user_id'                    => $userId,
                'marketing_service_id'       => $serviceId,
                'status'                     => ConsultantMarketingOrder::STATUS_PENDING,
                'amount'                     => (float) $service->price,
                'billing_type'               => $billingType,
                'province'                   => $metadata['province'] ?: null,
                'billing_country'            => $metadata['billing_country'] ?? null,
                'stripe_checkout_session_id' => $session->id,
            ]);
        }

        $this->assertNoDuplicateMarketingPurchase($userId, $serviceId, $order->id);

        $session = $this->expandSession($session, ['subscription', 'invoice']);
        $status  = $billingType === MarketingService::BILLING_MONTHLY
            ? ConsultantMarketingOrder::STATUS_ACTIVE
            : ConsultantMarketingOrder::STATUS_PAID;

        $stripeSub = $session->subscription;
        if (is_string($stripeSub)) {
            $stripeSub = StripeSubscription::retrieve($stripeSub);
        }

        $subtotal = $this->sessionSubtotal($session, $this->resolveInvoice($session->invoice)) ?? (float) $order->amount;
        $tax      = $this->sessionTax($session, $this->resolveInvoice($session->invoice)) ?? (float) ($order->tax_amount ?? 0);
        $total    = $this->sessionTotal($session, $this->resolveInvoice($session->invoice)) ?? ($subtotal + $tax);

        $billingAddress = $order->billing_address ?? $this->billingAddressFromUser(
            $user,
            $order->billing_country ?? ($metadata['billing_country'] ?? 'CA'),
            $order->province ?? ($metadata['province'] ?? null),
        );

        $order->update([
            'status'                 => $status,
            'paid_at'                => now(),
            'starts_at'              => now(),
            'amount'                 => $subtotal,
            'tax_amount'             => $tax,
            'stripe_subscription_id' => is_object($stripeSub) ? $stripeSub->id : ($stripeSub ?? null),
        ]);

        $stripeInvoice = $this->resolveInvoice($session->invoice);
        $payment = $this->recorder->recordMarketingPayment(
            $order,
            $user,
            $billingAddress,
            $session->id,
            is_object($stripeInvoice) ? ($stripeInvoice->id ?? null) : null,
            is_object($stripeInvoice) ? ($stripeInvoice->number ?? null) : ('MKT-' . str_pad((string) $order->id, 6, '0', STR_PAD_LEFT)),
            is_object($stripeInvoice) ? ($stripeInvoice->invoice_pdf ?? null) : null,
            is_object($stripeInvoice) ? ($stripeInvoice->hosted_invoice_url ?? null) : null,
            $subtotal,
            $tax,
            $total,
            is_object($stripeSub) ? $stripeSub->id : null,
        );

        $this->billingNotifications->onPaymentSucceeded(
            $user,
            $payment,
            $service->name ?? 'Marketing service',
        );

        return ['type' => 'marketing', 'order' => $order->fresh()->load('service'), 'payment' => $payment];
    }

    /** @return array<string, mixed> */
    public function fulfillStorageCheckout(object $session, ?User $user = null): array
    {
        $existing = ConsultantStorageAddon::where('stripe_checkout_session_id', $session->id)->first();
        if ($existing) {
            return ['type' => 'storage', 'addon' => $existing->load('package'), 'already' => true];
        }

        $metadata  = (array) ($session->metadata ?? []);
        $packageId = (int) ($metadata['storage_addon_package_id'] ?? 0);
        $cycle     = $metadata['billing_cycle'] ?? 'monthly';
        $userId    = (int) ($session->client_reference_id ?? $metadata['user_id'] ?? 0);

        if (! $packageId || ! $userId) {
            throw new \RuntimeException('Missing storage checkout metadata.');
        }

        $user ??= User::findOrFail($userId);
        $session = $this->expandSession($session, ['subscription', 'invoice']);

        $stripeSub = $session->subscription;
        if (is_string($stripeSub)) {
            $stripeSub = StripeSubscription::retrieve($stripeSub);
        }

        $package = StorageAddonPackage::findOrFail($packageId);
        $endsAt  = $stripeSub?->current_period_end
            ? Carbon::createFromTimestamp($stripeSub->current_period_end)
            : ($cycle === 'yearly' ? now()->addYear() : now()->addMonth());

        $billingAddress = $this->billingAddressFromUser(
            $user,
            $metadata['billing_country'] ?? 'CA',
            $metadata['province'] ?? null,
        );

        $addon = ConsultantStorageAddon::create([
            'user_id'                    => $userId,
            'storage_addon_package_id'   => $package->id,
            'status'                     => 'active',
            'billing_cycle'              => $cycle,
            'extra_bytes'                => $package->extraBytes(),
            'starts_at'                  => now(),
            'ends_at'                    => $endsAt,
            'stripe_customer_id'         => $this->customerId($session),
            'stripe_subscription_id'     => is_object($stripeSub) ? $stripeSub->id : $stripeSub,
            'stripe_checkout_session_id' => $session->id,
        ]);

        $subtotal = $cycle === 'yearly' ? (float) $package->yearly_price : (float) $package->monthly_price;
        $taxBreakdown = $this->taxService->quote($subtotal, $billingAddress);
        $stripeInvoice = $this->resolveInvoice($session->invoice);

        $payment = $this->recorder->recordStoragePayment(
            $addon,
            $user,
            $billingAddress,
            $taxBreakdown,
            $session->id,
            is_object($stripeInvoice) ? ($stripeInvoice->id ?? null) : null,
            is_object($stripeInvoice) ? ($stripeInvoice->number ?? null) : null,
            is_object($stripeInvoice) ? ($stripeInvoice->invoice_pdf ?? null) : null,
            is_object($stripeInvoice) ? ($stripeInvoice->hosted_invoice_url ?? null) : null,
            $this->sessionSubtotal($session, $stripeInvoice),
            $this->sessionTax($session, $stripeInvoice),
            $this->sessionTotal($session, $stripeInvoice),
            is_object($stripeSub) ? $stripeSub->id : null,
        );

        $this->billingNotifications->onPaymentSucceeded(
            $user,
            $payment,
            $package->name ?? 'Storage add-on',
        );

        return ['type' => 'storage', 'addon' => $addon->load('package'), 'payment' => $payment];
    }

    private function handlePlatformSubscriptionInvoicePaid(object $invoice, object $stripeSub): void
    {
        $updates = [
            'status'          => 'active',
            'last_payment_at' => now(),
        ];

        if ($stripeSub->current_period_end) {
            $updates['ends_at'] = Carbon::createFromTimestamp($stripeSub->current_period_end);
        }

        ConsultantSubscription::where('stripe_subscription_id', $stripeSub->id)->update($updates);

        $sub = ConsultantSubscription::where('stripe_subscription_id', $stripeSub->id)->first();
        if ($sub) {
            $payment = $this->recorder->recordFromStripeInvoice($invoice, $sub);
            $sub->loadMissing('user', 'package:id,name');
            if ($payment && $sub->user) {
                $this->billingNotifications->onPaymentSucceeded(
                    $sub->user,
                    $payment,
                    $sub->package?->name ?? 'Platform subscription',
                );
            }
        }
    }

    private function handleMarketingInvoicePaid(object $invoice, object $stripeSub): void
    {
        $order = ConsultantMarketingOrder::where('stripe_subscription_id', $stripeSub->id)->first();
        if (! $order) {
            return;
        }

        if ($stripeSub->current_period_end) {
            $order->update([
                'status'  => ConsultantMarketingOrder::STATUS_ACTIVE,
                'ends_at' => Carbon::createFromTimestamp($stripeSub->current_period_end),
            ]);
        }

        $user = $order->user;
        if ($user) {
            $payment = $this->recorder->recordMarketingFromStripeInvoice($invoice, $order, $user);
            if ($payment) {
                $this->billingNotifications->onPaymentSucceeded(
                    $user,
                    $payment,
                    $order->service?->name ?? 'Marketing service',
                );
            }
        }
    }

    private function handleStorageInvoicePaid(object $invoice, object $stripeSub): void
    {
        $addon = ConsultantStorageAddon::where('stripe_subscription_id', $stripeSub->id)->first();
        if (! $addon) {
            return;
        }

        $updates = ['status' => 'active'];
        if ($stripeSub->current_period_end) {
            $updates['ends_at'] = Carbon::createFromTimestamp($stripeSub->current_period_end);
        }
        $addon->update($updates);

        $user = $addon->user;
        if ($user) {
            $payment = $this->recorder->recordStorageFromStripeInvoice($invoice, $addon, $user);
            if ($payment) {
                $this->billingNotifications->onPaymentSucceeded(
                    $user,
                    $payment,
                    $addon->package?->name ?? 'Storage add-on',
                );
            }
        }
    }

    private function handlePlatformSubscriptionChange(object $subscription): void
    {
        $sub = ConsultantSubscription::where('stripe_subscription_id', $subscription->id)->first();
        if (! $sub) {
            return;
        }

        $status = $subscription->status ?? '';
        if (in_array($status, ['canceled', 'unpaid', 'incomplete_expired'], true)) {
            $sub->update(['status' => 'cancelled', 'cancelled_at' => now()]);

            return;
        }

        if (in_array($status, ['past_due', 'incomplete'], true)) {
            $sub->update(['status' => 'past_due']);

            return;
        }

        if ($status === 'active' && isset($subscription->current_period_end)) {
            $sub->update([
                'status'  => 'active',
                'ends_at' => Carbon::createFromTimestamp($subscription->current_period_end),
            ]);
        }
    }

    private function handleMarketingSubscriptionChange(object $subscription): void
    {
        $order = ConsultantMarketingOrder::where('stripe_subscription_id', $subscription->id)->first();
        if (! $order) {
            return;
        }

        $status = $subscription->status ?? '';
        if (in_array($status, ['canceled', 'unpaid', 'incomplete_expired'], true)) {
            $order->update(['status' => ConsultantMarketingOrder::STATUS_CANCELLED]);

            return;
        }

        if ($status === 'active' && isset($subscription->current_period_end)) {
            $order->update([
                'status'  => ConsultantMarketingOrder::STATUS_ACTIVE,
                'ends_at' => Carbon::createFromTimestamp($subscription->current_period_end),
            ]);
        }
    }

    private function handleStorageSubscriptionChange(object $subscription): void
    {
        $addon = ConsultantStorageAddon::where('stripe_subscription_id', $subscription->id)->first();
        if (! $addon) {
            return;
        }

        $status = $subscription->status ?? '';
        if (in_array($status, ['canceled', 'unpaid', 'incomplete_expired'], true)) {
            $addon->update(['status' => 'cancelled']);

            return;
        }

        if (in_array($status, ['past_due', 'incomplete'], true)) {
            $addon->update(['status' => 'past_due']);

            return;
        }

        if ($status === 'active' && isset($subscription->current_period_end)) {
            $addon->update([
                'status'  => 'active',
                'ends_at' => Carbon::createFromTimestamp($subscription->current_period_end),
            ]);
        }
    }

    private function assertNoDuplicateMarketingPurchase(int $userId, int $serviceId, int $excludeOrderId): void
    {
        $exists = ConsultantMarketingOrder::where('user_id', $userId)
            ->where('marketing_service_id', $serviceId)
            ->where('id', '!=', $excludeOrderId)
            ->whereIn('status', [ConsultantMarketingOrder::STATUS_PAID, ConsultantMarketingOrder::STATUS_ACTIVE])
            ->exists();

        if ($exists) {
            throw new \RuntimeException('You have already purchased this marketing service.');
        }
    }

    /** @param  list<string>  $expand */
    private function expandSession(object $session, array $expand): object
    {
        if (! empty($session->subscription) && ! empty($session->invoice)) {
            return $session;
        }

        return StripeSession::retrieve(['id' => $session->id, 'expand' => $expand]);
    }

    private function resolveInvoice(mixed $invoice): ?object
    {
        if (is_object($invoice)) {
            return $invoice;
        }
        if (is_string($invoice) && $invoice !== '') {
            try {
                new StripeService();

                return StripeInvoice::retrieve($invoice);
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }

    private function customerId(object $session): ?string
    {
        if (is_string($session->customer ?? null)) {
            return $session->customer;
        }

        return $session->customer->id ?? null;
    }

    /** @return array<string, mixed> */
    private function billingAddressFromUser(User $user, string $country, ?string $province): array
    {
        return [
            'line1'       => $user->company_address_line1,
            'line2'       => $user->company_address_line2,
            'city'        => $user->company_city,
            'province'    => $province ?? $user->company_province,
            'postal_code' => $user->company_postal_code,
            'country'     => $country,
        ];
    }

    private function sessionSubtotal(object $session, ?object $invoice): ?float
    {
        if ($invoice) {
            return round(($invoice->subtotal_excluding_tax ?? $invoice->subtotal ?? 0) / 100, 2);
        }

        if (isset($session->amount_subtotal)) {
            return round($session->amount_subtotal / 100, 2);
        }

        return null;
    }

    private function sessionTax(object $session, ?object $invoice): ?float
    {
        if ($invoice) {
            return round(($invoice->tax ?? 0) / 100, 2);
        }

        if (isset($session->amount_total, $session->amount_subtotal)) {
            return round(($session->amount_total - $session->amount_subtotal) / 100, 2);
        }

        return null;
    }

    private function sessionTotal(object $session, ?object $invoice): ?float
    {
        if ($invoice) {
            return round(($invoice->amount_paid ?? 0) / 100, 2);
        }

        if (isset($session->amount_total)) {
            return round($session->amount_total / 100, 2);
        }

        return null;
    }
}
