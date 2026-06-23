<?php

namespace App\Services;

use App\Models\ConsultantMarketingOrder;
use App\Models\ConsultantStorageAddon;
use App\Models\ConsultantSubscription;
use App\Models\MarketingService;
use App\Models\SubscriptionPaymentRecord;
use App\Models\User;
use Carbon\Carbon;

class SubscriptionPaymentRecorder
{
    /** @param array<string, mixed> $billingAddress */
    public function recordFromCheckout(
        ConsultantSubscription $subscription,
        User $user,
        array $billingAddress,
        array $taxBreakdown,
        string $paymentType = SubscriptionPaymentRecord::TYPE_INITIAL,
        ?string $checkoutSessionId = null,
        ?string $stripeInvoiceId = null,
        ?string $invoiceNumber = null,
        ?string $invoicePdf = null,
        ?string $hostedUrl = null,
        ?float $stripeSubtotal = null,
        ?float $stripeTax = null,
        ?float $stripeTotal = null,
    ): SubscriptionPaymentRecord {
        if ($stripeInvoiceId) {
            $existing = SubscriptionPaymentRecord::where('stripe_invoice_id', $stripeInvoiceId)->first();
            if ($existing) {
                return $existing;
            }
        }

        $package  = $subscription->package;
        $subtotal = $stripeSubtotal ?? (float) ($taxBreakdown['subtotal'] ?? 0);
        $tax      = $stripeTax ?? (float) ($taxBreakdown['total_tax'] ?? 0);
        $total    = $stripeTotal ?? (float) ($taxBreakdown['total'] ?? ($subtotal + $tax));

        return SubscriptionPaymentRecord::create([
            'user_id'                     => $user->id,
            'payment_category'            => SubscriptionPaymentRecord::CATEGORY_SUBSCRIPTION,
            'consultant_subscription_id'  => $subscription->id,
            'subscription_package_id'     => $subscription->subscription_package_id,
            'payment_type'                => $paymentType,
            'billing_cycle'               => $subscription->billing_cycle,
            'stripe_invoice_id'           => $stripeInvoiceId,
            'stripe_subscription_id'      => $subscription->stripe_subscription_id,
            'stripe_checkout_session_id'  => $checkoutSessionId,
            'invoice_number'              => $invoiceNumber,
            'currency'                    => 'CAD',
            'subtotal'                    => round($subtotal, 2),
            'tax_amount'                  => round($tax, 2),
            'total'                       => round($total, 2),
            'tax_label'                   => $taxBreakdown['tax_label'] ?? null,
            'tax_type'                    => $taxBreakdown['tax_type'] ?? null,
            'province'                    => $taxBreakdown['province'] ?? ($billingAddress['province'] ?? null),
            'country'                     => $billingAddress['country'] ?? 'CA',
            'gst_amount'                  => $taxBreakdown['gst_amount'] ?? null,
            'provincial_tax'              => $taxBreakdown['provincial_tax'] ?? null,
            'total_rate_pct'              => $taxBreakdown['total_rate_pct'] ?? null,
            'tax_applicable'              => (bool) ($taxBreakdown['tax_applicable'] ?? ($tax > 0)),
            'billing_address'             => $billingAddress,
            'invoice_pdf'                 => $invoicePdf,
            'hosted_invoice_url'          => $hostedUrl,
            'paid_at'                     => now(),
            'payment_status'              => SubscriptionPaymentRecord::STATUS_PAID,
        ]);
    }

    /** @param array<string, mixed> $billingAddress */
    public function recordMarketingPayment(
        ConsultantMarketingOrder $order,
        User $user,
        array $billingAddress,
        ?string $checkoutSessionId = null,
        ?string $stripeInvoiceId = null,
        ?string $invoiceNumber = null,
        ?string $invoicePdf = null,
        ?string $hostedUrl = null,
        ?float $subtotal = null,
        ?float $tax = null,
        ?float $total = null,
        ?string $stripeSubscriptionId = null,
    ): SubscriptionPaymentRecord {
        if ($stripeInvoiceId) {
            $existing = SubscriptionPaymentRecord::where('stripe_invoice_id', $stripeInvoiceId)->first();
            if ($existing) {
                return $existing;
            }
        }

        $order->loadMissing('service:id,name');
        $subtotal = $subtotal ?? (float) $order->amount;
        $tax      = $tax ?? (float) ($order->tax_amount ?? 0);
        $total    = $total ?? ($subtotal + $tax);
        $taxBreakdown = app(CanadianBillingTaxService::class)->quote($subtotal, $billingAddress);

        return SubscriptionPaymentRecord::create([
            'user_id'                       => $user->id,
            'payment_category'              => SubscriptionPaymentRecord::CATEGORY_MARKETING,
            'consultant_marketing_order_id' => $order->id,
            'service_name'                  => $order->service?->name,
            'payment_type'                  => SubscriptionPaymentRecord::TYPE_INITIAL,
            'billing_cycle'                 => $order->billing_type === MarketingService::BILLING_MONTHLY ? 'monthly' : 'one_time',
            'stripe_invoice_id'             => $stripeInvoiceId,
            'stripe_subscription_id'        => $stripeSubscriptionId ?? $order->stripe_subscription_id,
            'stripe_checkout_session_id'    => $checkoutSessionId,
            'invoice_number'                => $invoiceNumber,
            'currency'                      => 'CAD',
            'subtotal'                      => round($subtotal, 2),
            'tax_amount'                    => round($tax, 2),
            'total'                         => round($total, 2),
            'tax_label'                     => $taxBreakdown['tax_label'] ?? null,
            'tax_type'                      => $taxBreakdown['tax_type'] ?? null,
            'province'                      => $billingAddress['province'] ?? $order->province,
            'country'                       => $billingAddress['country'] ?? $order->billing_country ?? 'CA',
            'gst_amount'                    => $taxBreakdown['gst_amount'] ?? null,
            'provincial_tax'                => $taxBreakdown['provincial_tax'] ?? null,
            'total_rate_pct'                => $taxBreakdown['total_rate_pct'] ?? null,
            'tax_applicable'                => (bool) ($taxBreakdown['tax_applicable'] ?? ($tax > 0)),
            'billing_address'               => $billingAddress,
            'invoice_pdf'                   => $invoicePdf,
            'hosted_invoice_url'            => $hostedUrl,
            'paid_at'                       => now(),
            'payment_status'                => SubscriptionPaymentRecord::STATUS_PAID,
        ]);
    }

    public function recordMarketingFromStripeInvoice(object $invoice, ConsultantMarketingOrder $order, User $user): ?SubscriptionPaymentRecord
    {
        $invoiceId = $invoice->id ?? null;
        if (! $invoiceId) {
            return null;
        }

        $existing = SubscriptionPaymentRecord::where('stripe_invoice_id', $invoiceId)->first();
        if ($existing) {
            return $existing;
        }

        $billingAddress = $order->billing_address ?? $this->billingAddressFromUser($user, $order->billing_country ?? 'CA', $order->province);
        $subtotal = round(($invoice->subtotal_excluding_tax ?? $invoice->subtotal ?? 0) / 100, 2);
        $tax      = round(($invoice->tax ?? 0) / 100, 2);
        $total    = round(($invoice->amount_paid ?? 0) / 100, 2);
        $paidAt   = isset($invoice->status_transitions->paid_at)
            ? Carbon::createFromTimestamp($invoice->status_transitions->paid_at)
            : now();

        $order->loadMissing('service:id,name');

        return SubscriptionPaymentRecord::create([
            'user_id'                       => $user->id,
            'payment_category'              => SubscriptionPaymentRecord::CATEGORY_MARKETING,
            'consultant_marketing_order_id' => $order->id,
            'service_name'                  => $order->service?->name,
            'payment_type'                  => SubscriptionPaymentRecord::TYPE_RENEWAL,
            'billing_cycle'                 => 'monthly',
            'stripe_invoice_id'             => $invoiceId,
            'stripe_subscription_id'        => $order->stripe_subscription_id,
            'invoice_number'                => $invoice->number ?? null,
            'currency'                      => strtoupper($invoice->currency ?? 'cad'),
            'subtotal'                      => $subtotal,
            'tax_amount'                    => $tax,
            'total'                         => $total,
            'tax_label'                     => $tax > 0 ? 'GST/HST' : 'No Canadian sales tax',
            'tax_type'                      => $tax > 0 ? 'stripe' : 'export',
            'province'                      => $order->province,
            'country'                       => $order->billing_country ?? 'CA',
            'tax_applicable'                => $tax > 0,
            'billing_address'               => $billingAddress,
            'invoice_pdf'                   => $invoice->invoice_pdf ?? null,
            'hosted_invoice_url'            => $invoice->hosted_invoice_url ?? null,
            'paid_at'                       => $paidAt,
            'payment_status'                => SubscriptionPaymentRecord::STATUS_PAID,
        ]);
    }

    /** @param array<string, mixed> $billingAddress */
    public function recordStoragePayment(
        ConsultantStorageAddon $addon,
        User $user,
        array $billingAddress,
        array $taxBreakdown,
        ?string $checkoutSessionId = null,
        ?string $stripeInvoiceId = null,
        ?string $invoiceNumber = null,
        ?string $invoicePdf = null,
        ?string $hostedUrl = null,
        ?float $stripeSubtotal = null,
        ?float $stripeTax = null,
        ?float $stripeTotal = null,
        ?string $stripeSubscriptionId = null,
    ): SubscriptionPaymentRecord {
        if ($stripeInvoiceId) {
            $existing = SubscriptionPaymentRecord::where('stripe_invoice_id', $stripeInvoiceId)->first();
            if ($existing) {
                return $existing;
            }
        }

        $addon->loadMissing('package:id,name');
        $subtotal = $stripeSubtotal ?? (float) ($taxBreakdown['subtotal'] ?? 0);
        $tax      = $stripeTax ?? (float) ($taxBreakdown['total_tax'] ?? 0);
        $total    = $stripeTotal ?? (float) ($taxBreakdown['total'] ?? ($subtotal + $tax));

        return SubscriptionPaymentRecord::create([
            'user_id'                      => $user->id,
            'payment_category'             => SubscriptionPaymentRecord::CATEGORY_STORAGE,
            'consultant_storage_addon_id'  => $addon->id,
            'service_name'                 => $addon->package?->name,
            'payment_type'                 => SubscriptionPaymentRecord::TYPE_INITIAL,
            'billing_cycle'                => $addon->billing_cycle,
            'stripe_invoice_id'            => $stripeInvoiceId,
            'stripe_subscription_id'       => $stripeSubscriptionId ?? $addon->stripe_subscription_id,
            'stripe_checkout_session_id'   => $checkoutSessionId,
            'invoice_number'               => $invoiceNumber,
            'currency'                     => 'CAD',
            'subtotal'                     => round($subtotal, 2),
            'tax_amount'                   => round($tax, 2),
            'total'                        => round($total, 2),
            'tax_label'                    => $taxBreakdown['tax_label'] ?? null,
            'tax_type'                     => $taxBreakdown['tax_type'] ?? null,
            'province'                     => $taxBreakdown['province'] ?? ($billingAddress['province'] ?? null),
            'country'                      => $billingAddress['country'] ?? 'CA',
            'gst_amount'                   => $taxBreakdown['gst_amount'] ?? null,
            'provincial_tax'               => $taxBreakdown['provincial_tax'] ?? null,
            'total_rate_pct'               => $taxBreakdown['total_rate_pct'] ?? null,
            'tax_applicable'               => (bool) ($taxBreakdown['tax_applicable'] ?? ($tax > 0)),
            'billing_address'              => $billingAddress,
            'invoice_pdf'                  => $invoicePdf,
            'hosted_invoice_url'           => $hostedUrl,
            'paid_at'                      => now(),
            'payment_status'               => SubscriptionPaymentRecord::STATUS_PAID,
        ]);
    }

    public function recordStorageFromStripeInvoice(object $invoice, ConsultantStorageAddon $addon, User $user): ?SubscriptionPaymentRecord
    {
        $invoiceId = $invoice->id ?? null;
        if (! $invoiceId) {
            return null;
        }

        $existing = SubscriptionPaymentRecord::where('stripe_invoice_id', $invoiceId)->first();
        if ($existing) {
            return $existing;
        }

        $billingAddress = $this->billingAddressFromUser($user, $user->company_country ?? 'CA', $user->company_province);
        $subtotal = round(($invoice->subtotal_excluding_tax ?? $invoice->subtotal ?? 0) / 100, 2);
        $tax      = round(($invoice->tax ?? 0) / 100, 2);
        $total    = round(($invoice->amount_paid ?? 0) / 100, 2);
        $paidAt   = isset($invoice->status_transitions->paid_at)
            ? Carbon::createFromTimestamp($invoice->status_transitions->paid_at)
            : now();

        $addon->loadMissing('package:id,name');

        return SubscriptionPaymentRecord::create([
            'user_id'                     => $user->id,
            'payment_category'            => SubscriptionPaymentRecord::CATEGORY_STORAGE,
            'consultant_storage_addon_id' => $addon->id,
            'service_name'                => $addon->package?->name,
            'payment_type'                => SubscriptionPaymentRecord::TYPE_RENEWAL,
            'billing_cycle'               => $addon->billing_cycle,
            'stripe_invoice_id'           => $invoiceId,
            'stripe_subscription_id'      => $addon->stripe_subscription_id,
            'invoice_number'              => $invoice->number ?? null,
            'currency'                    => strtoupper($invoice->currency ?? 'cad'),
            'subtotal'                    => $subtotal,
            'tax_amount'                  => $tax,
            'total'                       => $total,
            'tax_label'                   => $tax > 0 ? 'GST/HST' : 'No Canadian sales tax',
            'tax_type'                    => $tax > 0 ? 'stripe' : 'export',
            'province'                    => $user->company_province,
            'country'                     => $user->company_country ?? 'CA',
            'tax_applicable'              => $tax > 0,
            'billing_address'             => $billingAddress,
            'invoice_pdf'                 => $invoice->invoice_pdf ?? null,
            'hosted_invoice_url'          => $invoice->hosted_invoice_url ?? null,
            'paid_at'                     => $paidAt,
            'payment_status'              => SubscriptionPaymentRecord::STATUS_PAID,
        ]);
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

    public function recordFromStripeInvoice(object $invoice, ConsultantSubscription $subscription): ?SubscriptionPaymentRecord
    {
        $invoiceId = $invoice->id ?? null;
        if (! $invoiceId) {
            return null;
        }

        $existing = SubscriptionPaymentRecord::where('stripe_invoice_id', $invoiceId)->first();
        if ($existing) {
            return $existing;
        }

        $user = $subscription->user;
        if (! $user) {
            return null;
        }

        $billingAddress = $subscription->billing_address ?? [];
        if (empty($billingAddress) && $subscription->billing_country) {
            $billingAddress = [
                'country'  => $subscription->billing_country,
                'province' => $subscription->billing_province,
            ];
        }

        $subtotal = round(($invoice->subtotal_excluding_tax ?? $invoice->subtotal ?? 0) / 100, 2);
        $tax      = round(($invoice->tax ?? 0) / 100, 2);
        $total    = round(($invoice->amount_paid ?? 0) / 100, 2);

        $taxService = app(CanadianBillingTaxService::class);
        $taxBreakdown = ! empty($billingAddress)
            ? $taxService->quote($subtotal, $billingAddress)
            : [
                'tax_label'      => $tax > 0 ? 'Sales tax' : 'No Canadian sales tax',
                'tax_type'       => $tax > 0 ? 'stripe' : 'export',
                'tax_applicable' => $tax > 0,
                'gst_amount'     => null,
                'provincial_tax' => null,
                'total_rate_pct' => $subtotal > 0 ? round(($tax / $subtotal) * 100, 3) : 0,
            ];

        $paidAt = isset($invoice->status_transitions->paid_at)
            ? Carbon::createFromTimestamp($invoice->status_transitions->paid_at)
            : now();

        $isRenewal = SubscriptionPaymentRecord::where('consultant_subscription_id', $subscription->id)->exists();

        return SubscriptionPaymentRecord::create([
            'user_id'                     => $user->id,
            'payment_category'            => SubscriptionPaymentRecord::CATEGORY_SUBSCRIPTION,
            'consultant_subscription_id'  => $subscription->id,
            'subscription_package_id'     => $subscription->subscription_package_id,
            'payment_type'                => $isRenewal ? SubscriptionPaymentRecord::TYPE_RENEWAL : SubscriptionPaymentRecord::TYPE_INITIAL,
            'billing_cycle'               => $subscription->billing_cycle,
            'stripe_invoice_id'           => $invoiceId,
            'stripe_subscription_id'      => $subscription->stripe_subscription_id,
            'invoice_number'              => $invoice->number ?? null,
            'currency'                    => strtoupper($invoice->currency ?? 'cad'),
            'subtotal'                    => $subtotal,
            'tax_amount'                  => $tax,
            'total'                       => $total,
            'tax_label'                   => $taxBreakdown['tax_label'] ?? null,
            'tax_type'                    => $taxBreakdown['tax_type'] ?? null,
            'province'                    => $subscription->billing_province,
            'country'                     => $subscription->billing_country ?? 'CA',
            'gst_amount'                  => $taxBreakdown['gst_amount'] ?? null,
            'provincial_tax'              => $taxBreakdown['provincial_tax'] ?? null,
            'total_rate_pct'              => $taxBreakdown['total_rate_pct'] ?? null,
            'tax_applicable'              => $tax > 0,
            'billing_address'             => $billingAddress ?: null,
            'invoice_pdf'                 => $invoice->invoice_pdf ?? null,
            'hosted_invoice_url'          => $invoice->hosted_invoice_url ?? null,
            'paid_at'                     => $paidAt,
            'payment_status'              => SubscriptionPaymentRecord::STATUS_PAID,
        ]);
    }

    public function recordPayPalPayment(
        ConsultantSubscription $subscription,
        User $user,
        string $paypalSaleId,
        float $grossAmount,
    ): ?SubscriptionPaymentRecord {
        $dedupeKey = 'paypal:' . $paypalSaleId;
        $existing  = SubscriptionPaymentRecord::where('stripe_invoice_id', $dedupeKey)->first();
        if ($existing) {
            return $existing;
        }

        $subscription->loadMissing('package:id,name,monthly_price,yearly_price');
        $billingAddress = [
            'line1'       => $user->company_address_line1,
            'line2'       => $user->company_address_line2,
            'city'        => $user->company_city,
            'province'    => $user->company_province,
            'postal_code' => $user->company_postal_code,
            'country'     => $user->company_country ?? 'CA',
        ];

        $subtotal = $subscription->billing_cycle === 'yearly'
            ? (float) ($subscription->package->yearly_price ?? 0)
            : (float) ($subscription->package->monthly_price ?? 0);
        $taxBreakdown = app(CanadianBillingTaxService::class)->quote($subtotal, $billingAddress);
        $total        = round($grossAmount, 2);
        $tax          = round(max(0, $total - $subtotal), 2);

        $isRenewal = SubscriptionPaymentRecord::where('consultant_subscription_id', $subscription->id)->exists();

        return SubscriptionPaymentRecord::create([
            'user_id'                    => $user->id,
            'payment_category'           => SubscriptionPaymentRecord::CATEGORY_SUBSCRIPTION,
            'consultant_subscription_id' => $subscription->id,
            'subscription_package_id'    => $subscription->subscription_package_id,
            'payment_type'               => $isRenewal ? SubscriptionPaymentRecord::TYPE_RENEWAL : SubscriptionPaymentRecord::TYPE_INITIAL,
            'billing_cycle'              => $subscription->billing_cycle,
            'stripe_invoice_id'          => $dedupeKey,
            'currency'                   => 'CAD',
            'subtotal'                   => round($subtotal, 2),
            'tax_amount'                 => $tax,
            'total'                      => $total,
            'tax_label'                  => $taxBreakdown['tax_label'] ?? null,
            'tax_type'                   => $taxBreakdown['tax_type'] ?? null,
            'province'                   => $billingAddress['province'] ?? null,
            'country'                    => $billingAddress['country'] ?? 'CA',
            'gst_amount'                 => $taxBreakdown['gst_amount'] ?? null,
            'provincial_tax'             => $taxBreakdown['provincial_tax'] ?? null,
            'total_rate_pct'             => $taxBreakdown['total_rate_pct'] ?? null,
            'tax_applicable'             => (bool) ($taxBreakdown['tax_applicable'] ?? ($tax > 0)),
            'billing_address'            => $billingAddress,
            'paid_at'                    => now(),
            'payment_status'             => SubscriptionPaymentRecord::STATUS_PAID,
        ]);
    }

    /** @return array<string, mixed> */
    public function formatRecord(SubscriptionPaymentRecord $record, string $audience = 'admin'): array
    {
        $record->loadMissing('user:id,name,email', 'package:id,name', 'subscription:id,billing_cycle,status');

        $category = $record->payment_category ?? SubscriptionPaymentRecord::CATEGORY_SUBSCRIPTION;
        $invoiceDownload = $audience === 'consultant'
            ? url("/api/v1/consultant/billing/payments/{$record->id}/invoice")
            : url("/api/v1/admin/subscription-payments/{$record->id}/invoice");

        return [
            'id'                 => $record->id,
            'category'           => $category,
            'payment_category'   => $category,
            'payment_type'       => $record->payment_type,
            'billing_cycle'      => $record->billing_cycle,
            'invoice_number'     => $record->invoice_number,
            'stripe_invoice_id'  => $record->stripe_invoice_id,
            'currency'           => $record->currency,
            'subtotal'           => (float) $record->subtotal,
            'tax_amount'         => (float) $record->tax_amount,
            'total'              => (float) $record->total,
            'tax_label'          => $record->tax_label,
            'tax_type'           => $record->tax_type,
            'province'           => $record->province,
            'country'            => $record->country,
            'gst_amount'         => $record->gst_amount !== null ? (float) $record->gst_amount : null,
            'provincial_tax'     => $record->provincial_tax !== null ? (float) $record->provincial_tax : null,
            'total_rate_pct'     => $record->total_rate_pct !== null ? (float) $record->total_rate_pct : null,
            'tax_applicable'     => $record->tax_applicable,
            'billing_address'    => $record->billing_address,
            'invoice_pdf'        => $record->invoice_pdf,
            'hosted_invoice_url' => $record->hosted_invoice_url,
            'paid_at'            => $record->paid_at?->toIso8601String(),
            'created_at'         => $record->created_at?->toIso8601String(),
            'user'               => $record->user ? [
                'id'    => $record->user->id,
                'name'  => $record->user->name,
                'email' => $record->user->email,
            ] : null,
            'package_name'       => $record->package?->name ?? $record->service_name,
            'service_name'       => $record->service_name,
            'description'        => $record->service_name ?? $record->package?->name,
            'subscription_status'=> $record->subscription?->status,
            'payment_status'     => $record->payment_status ?? SubscriptionPaymentRecord::STATUS_PAID,
            'can_download'       => ($record->payment_status ?? SubscriptionPaymentRecord::STATUS_PAID) === SubscriptionPaymentRecord::STATUS_PAID,
            'invoice_download'   => $invoiceDownload,
        ];
    }
}
