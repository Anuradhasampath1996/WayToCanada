<?php

namespace App\Services;

use App\Models\ConsultantMarketingOrder;
use App\Models\ConsultantSubscription;
use App\Models\MarketingService;
use App\Models\SubscriptionPaymentRecord;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Stripe\Invoice;
use Stripe\Subscription as StripeSubscription;

class ConsultantBillingService
{
    private ?StripeService $stripe = null;

    private bool $stripeResolved = false;

    private function stripe(): ?StripeService
    {
        if (! $this->stripeResolved) {
            $this->stripeResolved = true;
            try {
                $this->stripe = app(StripeService::class);
            } catch (\RuntimeException) {
                $this->stripe = null;
            }
        }

        return $this->stripe;
    }

    public function overview(User $user): array
    {
        $sub = $this->currentSubscription($user);
        $history = ConsultantSubscription::where('user_id', $user->id)
            ->with('package')
            ->orderByDesc('created_at')
            ->limit(12)
            ->get();

        $stripeMeta = $sub ? $this->stripeSubscriptionMeta($sub) : null;

        return [
            'subscription'       => $sub ? $this->formatSubscription($sub, $stripeMeta) : null,
            'is_active'          => $sub?->isCurrentlyActive() ?? false,
            'trial_used'         => ConsultantSubscription::where('user_id', $user->id)->where('is_trial', true)->exists(),
            'payment_history'    => $history->map(fn ($s) => $this->formatHistoryRow($s))->values(),
            'marketing_orders'   => $this->marketingOrdersSummary($user),
        ];
    }

    /** @return list<array<string, mixed>> */
    public function marketingOrdersSummary(User $user): array
    {
        return ConsultantMarketingOrder::where('user_id', $user->id)
            ->whereIn('status', [ConsultantMarketingOrder::STATUS_PAID, ConsultantMarketingOrder::STATUS_ACTIVE])
            ->with('service:id,slug,name,billing_type,price_label')
            ->orderByDesc('paid_at')
            ->get()
            ->map(function (ConsultantMarketingOrder $order) {
                $subtotal = (float) $order->amount;
                $tax      = (float) ($order->tax_amount ?? 0);
                $stripeMeta = $this->marketingStripeMeta($order);
                $isRecurring = $order->billing_type === MarketingService::BILLING_MONTHLY;
                $cancelAtEnd = (bool) ($stripeMeta['cancel_at_period_end'] ?? false);
                $canManage = $isRecurring
                    && (bool) $order->stripe_subscription_id
                    && in_array($order->status, [ConsultantMarketingOrder::STATUS_ACTIVE, ConsultantMarketingOrder::STATUS_PAID], true);

                return [
                    'id'                   => $order->id,
                    'service_name'         => $order->service?->name,
                    'service_slug'         => $order->service?->slug,
                    'status'               => $order->status,
                    'billing_type'         => $order->billing_type,
                    'price_label'          => $order->service?->price_label,
                    'subtotal'             => $subtotal,
                    'tax_amount'           => $tax,
                    'total'                => round($subtotal + $tax, 2),
                    'province'             => $order->province,
                    'paid_at'              => $order->paid_at?->toIso8601String(),
                    'ends_at'              => $order->ends_at?->toIso8601String(),
                    'cancelled_at'         => $order->cancelled_at?->toIso8601String(),
                    'is_recurring'         => $isRecurring,
                    'cancel_at_period_end' => $cancelAtEnd,
                    'auto_renew_enabled'   => $canManage ? ! $cancelAtEnd && ! $order->cancelled_at : false,
                    'can_manage_auto_renew'=> $canManage,
                    'next_billing_at'      => $stripeMeta['current_period_end'] ?? $order->ends_at?->toIso8601String(),
                ];
            })
            ->values()
            ->all();
    }

    /** @return list<array<string, mixed>> */
    public function invoices(User $user): array
    {
        $recorder = app(SubscriptionPaymentRecorder::class);

        $records = SubscriptionPaymentRecord::where('user_id', $user->id)
            ->orderByDesc('paid_at')
            ->limit(48)
            ->get();

        if ($records->isNotEmpty()) {
            return $records->map(fn ($r) => $this->formatPaymentInvoiceFromRecord($r, $recorder))->values()->all();
        }

        return $this->subscriptionInvoices($user);
    }

    /** @return array<string, mixed> */
    private function formatPaymentInvoiceFromRecord(SubscriptionPaymentRecord $record, SubscriptionPaymentRecorder $recorder): array
    {
        $formatted = $recorder->formatRecord($record, 'consultant');

        return [
            'id'                 => (string) $record->id,
            'category'           => $formatted['category'] ?? SubscriptionPaymentRecord::CATEGORY_SUBSCRIPTION,
            'payment_record_id'  => $record->id,
            'number'             => $formatted['invoice_number'],
            'description'        => $formatted['description'] ?? $formatted['package_name'],
            'package_name'       => $formatted['package_name'],
            'subtotal'           => $formatted['subtotal'],
            'tax_amount'         => $formatted['tax_amount'],
            'amount'             => $formatted['total'],
            'currency'           => $formatted['currency'],
            'status'             => ($formatted['payment_status'] ?? 'paid') === 'paid' ? 'paid' : $formatted['payment_status'],
            'tax_label'          => $formatted['tax_label'],
            'province'           => $formatted['province'],
            'country'            => $formatted['country'],
            'tax_applicable'     => $formatted['tax_applicable'],
            'payment_type'       => $formatted['payment_type'],
            'billing_cycle'      => $formatted['billing_cycle'],
            'paid_at'            => $formatted['paid_at'],
            'created_at'         => $formatted['created_at'] ?? $formatted['paid_at'],
            'invoice_pdf'        => $formatted['invoice_pdf'],
            'hosted_url'         => $formatted['hosted_invoice_url'],
            'source'             => 'record',
            'can_download'       => $formatted['can_download'],
            'invoice_download'   => $formatted['invoice_download'],
        ];
    }

    /** @return list<array<string, mixed>> */
    private function subscriptionInvoices(User $user): array
    {
        $records = SubscriptionPaymentRecord::where('user_id', $user->id)
            ->orderByDesc('paid_at')
            ->limit(24)
            ->get();

        if ($records->isNotEmpty()) {
            return $records->map(fn ($r) => $this->formatPaymentInvoice($r))->values()->all();
        }

        $sub = ConsultantSubscription::where('user_id', $user->id)
            ->whereNotNull('stripe_customer_id')
            ->latest()
            ->first();

        if (! $sub?->stripe_customer_id || ! $this->stripe()) {
            return $this->localInvoices($user);
        }

        try {
            $list = Invoice::all([
                'customer' => $sub->stripe_customer_id,
                'limit'    => 24,
            ]);

            return collect($list->data)->map(function ($inv) {
                $record = SubscriptionPaymentRecord::where('stripe_invoice_id', $inv->id)->first();

                return [
                    'id'               => $record?->id ? (string) $record->id : $inv->id,
                    'category'         => 'subscription',
                    'payment_record_id'=> $record?->id,
                    'number'           => $inv->number,
                    'subtotal'         => round(($inv->subtotal_excluding_tax ?? $inv->subtotal ?? 0) / 100, 2),
                    'tax_amount'       => round(($inv->tax ?? 0) / 100, 2),
                    'amount'           => round(($inv->amount_paid ?? 0) / 100, 2),
                    'currency'         => strtoupper($inv->currency ?? 'cad'),
                    'status'           => $inv->status,
                    'tax_label'        => $record?->tax_label,
                    'province'         => $record?->province,
                    'country'          => $record?->country,
                    'tax_applicable'   => $record?->tax_applicable ?? (($inv->tax ?? 0) > 0),
                    'paid_at'          => isset($inv->status_transitions->paid_at)
                        ? Carbon::createFromTimestamp($inv->status_transitions->paid_at)->toIso8601String()
                        : null,
                    'created_at'       => Carbon::createFromTimestamp($inv->created)->toIso8601String(),
                    'invoice_pdf'      => $inv->invoice_pdf,
                    'hosted_url'       => $inv->hosted_invoice_url,
                    'source'           => 'stripe',
                ];
            })->values()->all();
        } catch (\Throwable $e) {
            Log::warning('[Billing] Stripe invoices fetch failed', ['error' => $e->getMessage()]);

            return $this->localInvoices($user);
        }
    }

    public function cancel(User $user): array
    {
        $sub = ConsultantSubscription::where('user_id', $user->id)
            ->whereIn('status', ['trial', 'active'])
            ->latest()
            ->first();

        if (! $sub) {
            throw new \RuntimeException('No active subscription to cancel.');
        }

        if ($sub->status === 'trial') {
            $sub->update(['status' => 'cancelled', 'cancelled_at' => now()]);

            return [
                'message'      => 'Your free trial has been cancelled.',
                'subscription' => $this->formatSubscription($sub->fresh()->load('package'), null),
            ];
        }

        if ($sub->stripe_subscription_id) {
            if (! $this->stripe()) {
                throw new \RuntimeException('Stripe is not configured. Cannot cancel a Stripe subscription online.');
            }

            try {
                $stripeSub = StripeSubscription::update($sub->stripe_subscription_id, [
                    'cancel_at_period_end' => true,
                ]);

                $endsAt = $stripeSub->current_period_end
                    ? Carbon::createFromTimestamp($stripeSub->current_period_end)
                    : $sub->ends_at;

                $sub->update([
                    'cancelled_at' => now(),
                    'ends_at'      => $endsAt,
                ]);

                return [
                    'message'      => 'Subscription will cancel at the end of your billing period.',
                    'subscription' => $this->formatSubscription(
                        $sub->fresh()->load('package'),
                        ['cancel_at_period_end' => true, 'current_period_end' => $endsAt?->toIso8601String()],
                    ),
                ];
            } catch (\Throwable $e) {
                throw new \RuntimeException('Could not cancel subscription: ' . $e->getMessage());
            }
        }

        $sub->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        return [
            'message'      => 'Subscription cancelled.',
            'subscription' => $this->formatSubscription($sub->fresh()->load('package'), null),
        ];
    }

    public function setAutoRenew(User $user, bool $enabled): array
    {
        $sub = ConsultantSubscription::where('user_id', $user->id)
            ->where('status', 'active')
            ->where('is_trial', false)
            ->latest()
            ->first();

        if (! $sub || ! $sub->isCurrentlyActive()) {
            throw new \RuntimeException('No active paid subscription found.');
        }

        if ($sub->stripe_subscription_id && $this->stripe()) {
            try {
                $stripeSub = StripeSubscription::update($sub->stripe_subscription_id, [
                    'cancel_at_period_end' => ! $enabled,
                ]);

                $endsAt = isset($stripeSub->current_period_end)
                    ? Carbon::createFromTimestamp($stripeSub->current_period_end)
                    : $sub->ends_at;

                $sub->update([
                    'cancelled_at' => $enabled ? null : now(),
                    'ends_at'      => $endsAt,
                ]);
            } catch (\Throwable $e) {
                throw new \RuntimeException('Could not update automatic renewal: ' . $e->getMessage());
            }
        } else {
            $sub->update([
                'cancelled_at' => $enabled ? null : now(),
            ]);
        }

        $fresh = $sub->fresh()->load('package');
        $stripeMeta = $this->stripeSubscriptionMeta($fresh);

        return [
            'message'            => $enabled
                ? 'Automatic renewal is enabled. Your subscription will renew on the next billing date.'
                : 'Automatic renewal is off. You keep access until the end of your current billing period.',
            'auto_renew_enabled' => $enabled,
            'subscription'       => $this->formatSubscription($fresh, $stripeMeta),
        ];
    }

    public function cancelMarketingOrder(User $user, ConsultantMarketingOrder $order): array
    {
        if ($order->user_id !== $user->id) {
            throw new \RuntimeException('Marketing order not found.');
        }

        if ($order->billing_type !== MarketingService::BILLING_MONTHLY) {
            throw new \RuntimeException('Only monthly marketing services can be cancelled online.');
        }

        if (! in_array($order->status, [ConsultantMarketingOrder::STATUS_ACTIVE, ConsultantMarketingOrder::STATUS_PAID], true)) {
            throw new \RuntimeException('This marketing service is not active.');
        }

        if (! $order->stripe_subscription_id) {
            $order->update([
                'status'       => ConsultantMarketingOrder::STATUS_CANCELLED,
                'cancelled_at' => now(),
            ]);

            return [
                'message' => 'Marketing service cancelled.',
                'order'   => $this->formatMarketingOrderSummary($order->fresh()->load('service:id,slug,name,billing_type,price_label')),
            ];
        }

        if (! $this->stripe()) {
            throw new \RuntimeException('Stripe is not configured. Cannot cancel this marketing subscription online.');
        }

        try {
            $stripeSub = StripeSubscription::update($order->stripe_subscription_id, [
                'cancel_at_period_end' => true,
            ]);

            $endsAt = $stripeSub->current_period_end
                ? Carbon::createFromTimestamp($stripeSub->current_period_end)
                : $order->ends_at;

            $order->update([
                'cancelled_at' => now(),
                'ends_at'      => $endsAt,
            ]);

            return [
                'message' => 'Marketing service will cancel at the end of your billing period.',
                'order'   => $this->formatMarketingOrderSummary($order->fresh()->load('service:id,slug,name,billing_type,price_label')),
            ];
        } catch (\Throwable $e) {
            throw new \RuntimeException('Could not cancel marketing service: ' . $e->getMessage());
        }
    }

    public function setMarketingAutoRenew(User $user, ConsultantMarketingOrder $order, bool $enabled): array
    {
        if ($order->user_id !== $user->id) {
            throw new \RuntimeException('Marketing order not found.');
        }

        if ($order->billing_type !== MarketingService::BILLING_MONTHLY || ! $order->stripe_subscription_id) {
            throw new \RuntimeException('Automatic renewal cannot be managed for this marketing service.');
        }

        if (! in_array($order->status, [ConsultantMarketingOrder::STATUS_ACTIVE, ConsultantMarketingOrder::STATUS_PAID], true)) {
            throw new \RuntimeException('This marketing service is not active.');
        }

        if (! $this->stripe()) {
            throw new \RuntimeException('Stripe is not configured.');
        }

        try {
            $stripeSub = StripeSubscription::update($order->stripe_subscription_id, [
                'cancel_at_period_end' => ! $enabled,
            ]);

            $endsAt = isset($stripeSub->current_period_end)
                ? Carbon::createFromTimestamp($stripeSub->current_period_end)
                : $order->ends_at;

            $order->update([
                'cancelled_at' => $enabled ? null : now(),
                'ends_at'      => $endsAt,
            ]);
        } catch (\Throwable $e) {
            throw new \RuntimeException('Could not update marketing renewal: ' . $e->getMessage());
        }

        $fresh = $order->fresh()->load('service:id,slug,name,billing_type,price_label');

        return [
            'message'            => $enabled
                ? 'Marketing service will renew automatically on the next billing date.'
                : 'Automatic renewal is off. Access continues until the end of the current billing period.',
            'auto_renew_enabled' => $enabled,
            'order'              => $this->formatMarketingOrderSummary($fresh),
        ];
    }

    /** @return array<string, mixed> */
    private function formatMarketingOrderSummary(ConsultantMarketingOrder $order): array
    {
        $order->loadMissing('service:id,slug,name,billing_type,price_label');
        $subtotal = (float) $order->amount;
        $tax      = (float) ($order->tax_amount ?? 0);
        $stripeMeta = $this->marketingStripeMeta($order);
        $isRecurring = $order->billing_type === MarketingService::BILLING_MONTHLY;
        $cancelAtEnd = (bool) ($stripeMeta['cancel_at_period_end'] ?? false);
        $canManage = $isRecurring
            && (bool) $order->stripe_subscription_id
            && in_array($order->status, [ConsultantMarketingOrder::STATUS_ACTIVE, ConsultantMarketingOrder::STATUS_PAID], true);

        return [
            'id'                   => $order->id,
            'service_name'         => $order->service?->name,
            'service_slug'         => $order->service?->slug,
            'status'               => $order->status,
            'billing_type'         => $order->billing_type,
            'price_label'          => $order->service?->price_label,
            'subtotal'             => $subtotal,
            'tax_amount'           => $tax,
            'total'                => round($subtotal + $tax, 2),
            'province'             => $order->province,
            'paid_at'              => $order->paid_at?->toIso8601String(),
            'ends_at'              => $order->ends_at?->toIso8601String(),
            'cancelled_at'         => $order->cancelled_at?->toIso8601String(),
            'is_recurring'         => $isRecurring,
            'cancel_at_period_end' => $cancelAtEnd,
            'auto_renew_enabled'   => $canManage ? ! $cancelAtEnd && ! $order->cancelled_at : false,
            'can_manage_auto_renew'=> $canManage,
            'next_billing_at'      => $stripeMeta['current_period_end'] ?? $order->ends_at?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed>|null */
    private function marketingStripeMeta(ConsultantMarketingOrder $order): ?array
    {
        if (! $order->stripe_subscription_id || ! $this->stripe()) {
            return null;
        }

        try {
            $stripeSub = StripeSubscription::retrieve($order->stripe_subscription_id);

            return [
                'cancel_at_period_end' => (bool) ($stripeSub->cancel_at_period_end ?? false),
                'current_period_end'   => isset($stripeSub->current_period_end)
                    ? Carbon::createFromTimestamp($stripeSub->current_period_end)->toIso8601String()
                    : null,
                'stripe_status'        => $stripeSub->status ?? null,
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    private function currentSubscription(User $user): ?ConsultantSubscription
    {
        $sub = ConsultantSubscription::where('user_id', $user->id)
            ->whereIn('status', ['trial', 'active'])
            ->latest()
            ->first();

        if ($sub) {
            if ($sub->status === 'trial' && $sub->trial_ends_at?->isPast()) {
                $sub->update(['status' => 'expired']);
                $sub->refresh();
            } elseif ($sub->status === 'active' && $sub->ends_at?->isPast() && ! $sub->stripe_subscription_id) {
                $sub->update(['status' => 'expired']);
                $sub->refresh();
            }
        }

        if ($sub?->isCurrentlyActive()) {
            return $sub->load('package');
        }

        return ConsultantSubscription::where('user_id', $user->id)
            ->with('package')
            ->latest()
            ->first();
    }

    /** @return array<string, mixed>|null */
    private function stripeSubscriptionMeta(ConsultantSubscription $sub): ?array
    {
        if (! $sub->stripe_subscription_id || ! $this->stripe()) {
            return null;
        }

        try {
            $stripeSub = StripeSubscription::retrieve($sub->stripe_subscription_id);

            return [
                'cancel_at_period_end' => (bool) ($stripeSub->cancel_at_period_end ?? false),
                'current_period_end'   => isset($stripeSub->current_period_end)
                    ? Carbon::createFromTimestamp($stripeSub->current_period_end)->toIso8601String()
                    : null,
                'stripe_status'        => $stripeSub->status ?? null,
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    /** @param array<string, mixed>|null $stripeMeta */
    private function formatSubscription(ConsultantSubscription $sub, ?array $stripeMeta): array
    {
        $package = $sub->package;
        $price   = null;

        if ($package && $sub->billing_cycle) {
            $price = $sub->billing_cycle === 'yearly'
                ? $package->yearly_price
                : $package->monthly_price;
        }

        $cancelAtPeriodEnd = $stripeMeta['cancel_at_period_end'] ?? (
            $sub->status === 'active' && $sub->cancelled_at !== null
        );

        $canManageAutoRenew = $sub->status === 'active' && ! $sub->is_trial && $sub->isCurrentlyActive();
        $autoRenewEnabled   = $canManageAutoRenew && ! $cancelAtPeriodEnd;

        return [
            'id'                    => $sub->id,
            'status'                => $sub->status,
            'is_trial'              => $sub->is_trial,
            'billing_cycle'         => $sub->billing_cycle,
            'package_name'          => $package?->name,
            'package_description'   => $package?->description,
            'price'                 => $price,
            'currency'              => 'CAD',
            'starts_at'             => $sub->starts_at?->toIso8601String(),
            'ends_at'               => $sub->ends_at?->toIso8601String(),
            'trial_ends_at'         => $sub->trial_ends_at?->toIso8601String(),
            'last_payment_at'       => $sub->last_payment_at?->toIso8601String(),
            'cancelled_at'          => $sub->cancelled_at?->toIso8601String(),
            'cancel_at_period_end'  => $cancelAtPeriodEnd,
            'next_billing_at'       => $stripeMeta['current_period_end'] ?? $sub->ends_at?->toIso8601String(),
            'stripe_status'         => $stripeMeta['stripe_status'] ?? null,
            'has_stripe'            => (bool) $sub->stripe_subscription_id,
            'auto_renew_enabled'    => $autoRenewEnabled,
            'can_manage_auto_renew' => $canManageAutoRenew,
        ];
    }

    private function formatHistoryRow(ConsultantSubscription $sub): array
    {
        $package = $sub->package;
        $price   = $sub->billing_cycle === 'yearly'
            ? $package?->yearly_price
            : ($sub->billing_cycle === 'monthly' ? $package?->monthly_price : null);

        return [
            'id'            => $sub->id,
            'package_name'  => $package?->name,
            'status'        => $sub->status,
            'billing_cycle' => $sub->billing_cycle,
            'amount'        => $price,
            'currency'      => 'CAD',
            'paid_at'       => $sub->last_payment_at?->toIso8601String(),
            'starts_at'     => $sub->starts_at?->toIso8601String(),
            'ends_at'       => $sub->ends_at?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    private function formatMarketingPayment(ConsultantMarketingOrder $order): array
    {
        $order->loadMissing('service:id,slug,name');
        $subtotal = (float) $order->amount;
        $tax      = (float) ($order->tax_amount ?? 0);
        $total    = round($subtotal + $tax, 2);

        return [
            'id'                 => 'marketing-' . $order->id,
            'category'           => 'marketing',
            'marketing_order_id' => $order->id,
            'payment_record_id'  => null,
            'number'             => 'MKT-' . str_pad((string) $order->id, 6, '0', STR_PAD_LEFT),
            'description'        => $order->service?->name,
            'package_name'       => $order->service?->name,
            'service_slug'       => $order->service?->slug,
            'subtotal'           => $subtotal,
            'tax_amount'         => $tax,
            'amount'             => $total,
            'currency'           => 'CAD',
            'status'             => 'paid',
            'tax_label'          => $tax > 0 ? 'GST/HST' : null,
            'province'           => $order->province,
            'country'            => $order->billing_country ?? 'CA',
            'tax_applicable'     => $tax > 0,
            'payment_type'       => $order->billing_type === MarketingService::BILLING_MONTHLY ? 'monthly' : 'one_time',
            'billing_cycle'      => $order->billing_type === MarketingService::BILLING_MONTHLY ? 'monthly' : null,
            'paid_at'            => $order->paid_at?->toIso8601String(),
            'created_at'         => ($order->paid_at ?? $order->created_at)?->toIso8601String(),
            'invoice_pdf'        => null,
            'hosted_url'         => null,
            'source'             => 'marketing',
            'can_download'       => false,
            'invoice_download'   => null,
        ];
    }

    /** @return array<string, mixed> */
    private function formatPaymentInvoice(SubscriptionPaymentRecord $record): array
    {
        return [
            'id'               => (string) $record->id,
            'category'         => 'subscription',
            'payment_record_id'=> $record->id,
            'number'           => $record->invoice_number ?? ('PAY-' . str_pad((string) $record->id, 6, '0', STR_PAD_LEFT)),
            'subtotal'         => (float) $record->subtotal,
            'tax_amount'       => (float) $record->tax_amount,
            'amount'           => (float) $record->total,
            'currency'         => $record->currency,
            'status'           => 'paid',
            'tax_label'        => $record->tax_label,
            'province'         => $record->province,
            'country'          => $record->country,
            'tax_applicable'   => $record->tax_applicable,
            'gst_amount'       => $record->gst_amount !== null ? (float) $record->gst_amount : null,
            'provincial_tax'   => $record->provincial_tax !== null ? (float) $record->provincial_tax : null,
            'paid_at'          => $record->paid_at?->toIso8601String(),
            'created_at'       => ($record->paid_at ?? $record->created_at)?->toIso8601String(),
            'invoice_pdf'      => $record->invoice_pdf,
            'hosted_url'       => $record->hosted_invoice_url,
            'source'           => $record->stripe_invoice_id ? 'stripe' : 'local',
            'payment_type'     => $record->payment_type,
            'can_download'     => true,
            'invoice_download' => url("/api/v1/consultant/billing/payments/{$record->id}/invoice"),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function localInvoices(User $user): array
    {
        return ConsultantSubscription::where('user_id', $user->id)
            ->whereNotNull('last_payment_at')
            ->with('package')
            ->orderByDesc('last_payment_at')
            ->limit(24)
            ->get()
            ->map(function ($sub) {
                $price = $sub->billing_cycle === 'yearly'
                    ? $sub->package?->yearly_price
                    : $sub->package?->monthly_price;

                return [
                    'id'          => 'local-' . $sub->id,
                    'category'    => 'subscription',
                    'number'      => 'SUB-' . str_pad((string) $sub->id, 6, '0', STR_PAD_LEFT),
                    'amount'      => $price,
                    'currency'    => 'CAD',
                    'status'      => 'paid',
                    'paid_at'     => $sub->last_payment_at?->toIso8601String(),
                    'created_at'  => $sub->last_payment_at?->toIso8601String(),
                    'invoice_pdf' => null,
                    'hosted_url'  => null,
                    'source'      => 'local',
                ];
            })
            ->values()
            ->all();
    }
}
