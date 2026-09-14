<?php

namespace App\Services\Referral;

use App\Contracts\StripePlatformClient;
use App\Models\SubscriptionPaymentRecord;
use Illuminate\Support\Facades\Log;

class StripePaymentRecordResolver
{
    public function fromCharge(object $charge): ?SubscriptionPaymentRecord
    {
        $invoiceId = $this->invoiceIdFromCharge($charge);
        $sessionId = $charge->metadata->checkout_session_id ?? null;
        $paymentIntent = is_string($charge->payment_intent ?? null) ? $charge->payment_intent : ($charge->payment_intent->id ?? null);

        if ($invoiceId) {
            $byInvoice = SubscriptionPaymentRecord::query()->where('stripe_invoice_id', $invoiceId)->first();
            if ($byInvoice) {
                return $byInvoice;
            }
        }

        if ($sessionId) {
            $bySession = SubscriptionPaymentRecord::query()->where('stripe_checkout_session_id', $sessionId)->first();
            if ($bySession) {
                return $bySession;
            }
        }

        if ($paymentIntent) {
            $byIntent = SubscriptionPaymentRecord::query()
                ->where('stripe_invoice_id', $paymentIntent)
                ->first();
            if ($byIntent) {
                return $byIntent;
            }
        }

        return null;
    }

    public function invoiceIdFromCharge(object $charge): ?string
    {
        $invoice = $charge->invoice ?? null;
        if (is_string($invoice) && str_starts_with($invoice, 'in_')) {
            return $invoice;
        }
        if (is_object($invoice) && isset($invoice->id) && str_starts_with((string) $invoice->id, 'in_')) {
            return (string) $invoice->id;
        }

        $paymentIntent = $charge->payment_intent ?? null;
        $intentId = is_object($paymentIntent) ? ($paymentIntent->id ?? null) : $paymentIntent;
        if (! is_string($intentId) || $intentId === '') {
            return null;
        }

        try {
            $invoiceId = app(StripePlatformClient::class)->invoiceIdForPaymentIntent($intentId);
            if (is_string($invoiceId) && str_starts_with($invoiceId, 'in_')) {
                return $invoiceId;
            }
        } catch (\Throwable $e) {
            Log::info('[Referral] Could not resolve invoice from payment intent', [
                'payment_intent' => $intentId,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }
}
