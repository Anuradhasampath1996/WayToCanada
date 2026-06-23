<?php

namespace App\Http\Controllers;

use App\Models\ClientPaymentRequest;
use App\Models\ConsultantPaymentAccount;
use App\Models\PaymentGatewaySetting;
use App\Services\ClientPaymentRequestService;
use App\Services\StripePaymentFulfillmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Webhook;

class StripeWebhookController extends Controller
{
    public function __construct(
        private StripePaymentFulfillmentService $fulfillment,
        private ClientPaymentRequestService $clientPayments,
    ) {}

    public function handle(Request $request): JsonResponse
    {
        $payload   = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature', '');

        try {
            $setting = PaymentGatewaySetting::where('gateway', 'stripe')
                ->where('is_active', true)
                ->first();

            if (! $setting) {
                return response()->json(['message' => 'Stripe not configured'], 503);
            }

            $secret = PaymentGatewaySetting::decryptKey($setting->webhook_id) ?? $setting->webhook_id;
            if (! $secret) {
                Log::warning('[Stripe] Webhook received but webhook secret not configured');

                return response()->json(['message' => 'Webhook secret not configured'], 503);
            }

            $event = Webhook::constructEvent($payload, $sigHeader, $secret);
        } catch (\Throwable $e) {
            Log::error('[Stripe] Webhook verification failed', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'Invalid signature'], 400);
        }

        $type               = $event->type;
        $data               = $event->data->object;
        $connectedAccountId = $event->account ?? null;

        Log::info('[Stripe] Webhook', [
            'type'    => $type,
            'account' => $connectedAccountId,
        ]);

        $this->recordWebhookHealth($setting, $type, $connectedAccountId);

        try {
            if ($connectedAccountId) {
                $this->handleConnectEvent($type, $data, $connectedAccountId);
            } else {
                $this->handlePlatformEvent($type, $data);
            }
        } catch (\Throwable $e) {
            Log::error('[Stripe] Webhook handler failed', [
                'type'    => $type,
                'account' => $connectedAccountId,
                'error'   => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Handler error'], 500);
        }

        return response()->json(['received' => true]);
    }

    private function handlePlatformEvent(string $type, object $data): void
    {
        match ($type) {
            'checkout.session.completed' => $this->handlePlatformCheckoutCompleted($data),
            'invoice.paid'                 => $this->fulfillment->handleInvoicePaid($data),
            'invoice.payment_failed'       => $this->fulfillment->handleInvoicePaymentFailed($data),
            'customer.subscription.deleted',
            'customer.subscription.updated' => $this->fulfillment->handleSubscriptionUpdated($data),
            'charge.refunded'              => $this->handleChargeRefunded($data),
            default => null,
        };
    }

    private function handleConnectEvent(string $type, object $data, string $connectedAccountId): void
    {
        match ($type) {
            'checkout.session.completed' => $this->handleConnectCheckoutCompleted($data, $connectedAccountId),
            'account.updated'            => $this->handleConnectAccountUpdated($data, $connectedAccountId),
            default => Log::debug('[Stripe] Connect event ignored', ['type' => $type]),
        };
    }

    private function handlePlatformCheckoutCompleted(object $session): void
    {
        if (($session->mode ?? '') === 'payment') {
            $metadata = (array) ($session->metadata ?? []);
            if (($metadata['type'] ?? '') === 'marketing_service') {
                $this->fulfillment->fulfillMarketingCheckout($session);

                return;
            }

            // Platform-mode client payments (legacy) — Connect checkouts use connected account events.
            $this->handleClientPaymentCheckout($session);

            return;
        }

        $result = $this->fulfillment->fulfillCheckoutSession($session);
        if ($result) {
            Log::info('[Stripe] Checkout fulfilled via webhook', ['type' => $result['type'] ?? 'unknown']);
        }
    }

    private function handleConnectCheckoutCompleted(object $session, string $connectedAccountId): void
    {
        try {
            $paymentRequest = $this->clientPayments->markPaidFromConnectWebhook($session, $connectedAccountId);
        } catch (\Throwable $e) {
            Log::warning('[Stripe] Connect checkout fulfillment failed', [
                'error'   => $e->getMessage(),
                'account' => $connectedAccountId,
            ]);

            return;
        }

        if ($paymentRequest) {
            Log::info('[Stripe] Client payment marked paid via Connect webhook', [
                'payment_request_id' => $paymentRequest->id,
                'account'            => $connectedAccountId,
            ]);
        }
    }

    private function handleConnectAccountUpdated(object $account, string $connectedAccountId): void
    {
        $record = ConsultantPaymentAccount::where('stripe_connect_account_id', $connectedAccountId)->first();
        if (! $record) {
            return;
        }

        $record->update([
            'stripe_charges_enabled'   => (bool) ($account->charges_enabled ?? false),
            'stripe_details_submitted' => (bool) ($account->details_submitted ?? false),
        ]);
    }

    private function handleClientPaymentCheckout(object $session): void
    {
        $requestId = $session->metadata->payment_request_id ?? null;
        if (! $requestId) {
            return;
        }

        $paymentRequest = ClientPaymentRequest::find($requestId);
        if (! $paymentRequest || $paymentRequest->status === 'paid') {
            return;
        }

        if (($session->payment_status ?? '') !== 'paid') {
            return;
        }

        $this->clientPayments->markPaid($paymentRequest);

        Log::info('[Stripe] Client payment request marked paid', [
            'payment_request_id' => $paymentRequest->id,
            'session_id'         => $session->id,
        ]);
    }

    private function handleChargeRefunded(object $charge): void
    {
        $paymentIntent = $charge->payment_intent ?? null;
        $sessionId     = $charge->metadata->checkout_session_id ?? null;

        if (! $paymentIntent && ! $sessionId) {
            return;
        }

        $query = \App\Models\SubscriptionPaymentRecord::query();

        $query->where(function ($q) use ($paymentIntent, $sessionId) {
            if ($paymentIntent) {
                $q->where('stripe_invoice_id', $paymentIntent);
            }
            if ($sessionId) {
                $paymentIntent
                    ? $q->orWhere('stripe_checkout_session_id', $sessionId)
                    : $q->where('stripe_checkout_session_id', $sessionId);
            }
        });

        $query->update(['payment_status' => \App\Models\SubscriptionPaymentRecord::STATUS_REFUNDED]);
    }

    private function recordWebhookHealth(PaymentGatewaySetting $setting, string $type, ?string $connectedAccountId): void
    {
        $setting->update([
            'last_webhook_at'      => now(),
            'last_webhook_type'    => $type,
            'last_webhook_account' => $connectedAccountId,
        ]);
    }
}
