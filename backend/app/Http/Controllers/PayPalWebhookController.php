<?php

namespace App\Http\Controllers;

use App\Models\ConsultantSubscription;
use App\Models\PaymentGatewaySetting;
use App\Services\Notifications\ConsultantBillingNotificationService;
use App\Services\PayPalSubscriptionService;
use App\Services\SubscriptionPaymentRecorder;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

/**
 * Handles incoming PayPal webhook events for subscription billing.
 *
 * Route: POST /api/v1/webhooks/paypal  (public, no auth)
 *
 * Set PAYPAL_WEBHOOK_ID in .env (from PayPal Developer Dashboard
 * → Apps → RCICMASTER_Testing → Webhooks → Webhook ID).
 */
class PayPalWebhookController extends Controller
{
    public function __construct(
        private SubscriptionPaymentRecorder $recorder,
        private ConsultantBillingNotificationService $billingNotifications,
    ) {}

    public function handle(Request $request): Response
    {
        $rawBody   = $request->getContent();
        $eventData = json_decode($rawBody, true);

        if (! $eventData) {
            return response('Invalid payload', 400);
        }

        $setting = PaymentGatewaySetting::where('gateway', 'paypal')->first();

        // ── Optional signature verification ──────────────────────────────────
        // Read webhook_id from DB (set via Admin → Payment Gateway).
        // Fall back to env for local dev. Skip verification if neither is set.
        $webhookId = ($setting?->webhook_id) ?: config('services.paypal.webhook_id');

        if ($webhookId) {
            try {
                $svc = new PayPalSubscriptionService();
                $headers = [
                    'PAYPAL-AUTH-ALGO'         => $request->header('PAYPAL-AUTH-ALGO', ''),
                    'PAYPAL-CERT-URL'           => $request->header('PAYPAL-CERT-URL', ''),
                    'PAYPAL-TRANSMISSION-ID'    => $request->header('PAYPAL-TRANSMISSION-ID', ''),
                    'PAYPAL-TRANSMISSION-SIG'   => $request->header('PAYPAL-TRANSMISSION-SIG', ''),
                    'PAYPAL-TRANSMISSION-TIME'  => $request->header('PAYPAL-TRANSMISSION-TIME', ''),
                ];
                if (! $svc->verifyWebhookSignature($webhookId, $headers, $rawBody)) {
                    Log::warning('[PayPal Webhook] Signature verification failed');
                    return response('Unauthorized', 401);
                }
            } catch (\Throwable $e) {
                Log::error('[PayPal Webhook] Verification error: ' . $e->getMessage());
                // Don't block processing on verification failure in case of transient error
            }
        }

        $eventType     = $eventData['event_type']     ?? '';
        $resource      = $eventData['resource']       ?? [];
        $subscriptionId = $resource['id']             ?? null;

        Log::info("[PayPal Webhook] event={$eventType} subscription={$subscriptionId}");

        if ($setting) {
            $setting->update([
                'last_webhook_at'      => now(),
                'last_webhook_type'    => $eventType,
                'last_webhook_account' => null,
            ]);
        }

        match ($eventType) {
            // ── Subscription lifecycle ────────────────────────────────────────
            'BILLING.SUBSCRIPTION.ACTIVATED' => $this->onActivated($subscriptionId, $resource),
            'BILLING.SUBSCRIPTION.CANCELLED' => $this->onCancelled($subscriptionId),
            'BILLING.SUBSCRIPTION.EXPIRED'   => $this->onExpired($subscriptionId),
            'BILLING.SUBSCRIPTION.SUSPENDED' => $this->onCancelled($subscriptionId),

            // ── Payment events ────────────────────────────────────────────────
            'PAYMENT.SALE.COMPLETED'                         => $this->onPaymentCompleted($resource),
            'BILLING.SUBSCRIPTION.PAYMENT.FAILED'            => $this->onPaymentFailed($subscriptionId),

            default => null, // ignore unhandled events
        };

        // Always return 200 so PayPal stops retrying
        return response('OK', 200);
    }

    // ─────────────────────────────────────────────────────────────────────────

    private function onActivated(?string $subscriptionId, array $resource): void
    {
        if (! $subscriptionId) return;

        $sub = ConsultantSubscription::where('paypal_subscription_id', $subscriptionId)->first();
        if (! $sub) return;

        $nextBilling = $resource['billing_info']['next_billing_time'] ?? null;

        $sub->update([
            'status'          => 'active',
            'last_payment_at' => now(),
            'ends_at'         => $nextBilling ? \Carbon\Carbon::parse($nextBilling) : $sub->ends_at,
        ]);
    }

    private function onCancelled(?string $subscriptionId): void
    {
        if (! $subscriptionId) return;

        ConsultantSubscription::where('paypal_subscription_id', $subscriptionId)
            ->whereNotIn('status', ['cancelled', 'expired'])
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);
    }

    private function onExpired(?string $subscriptionId): void
    {
        if (! $subscriptionId) return;

        ConsultantSubscription::where('paypal_subscription_id', $subscriptionId)
            ->whereNotIn('status', ['cancelled', 'expired'])
            ->update(['status' => 'expired']);
    }

    private function onPaymentCompleted(array $resource): void
    {
        // The billing_agreement_id in the sale resource IS the subscription ID
        $subscriptionId = $resource['billing_agreement_id'] ?? null;
        if (! $subscriptionId) return;

        $sub = ConsultantSubscription::where('paypal_subscription_id', $subscriptionId)
            ->with('user', 'package')
            ->first();
        if (! $sub || ! $sub->user) return;

        $saleId = $resource['id'] ?? null;
        $amount = (float) ($resource['amount']['total'] ?? 0);

        // Extend the subscription by one billing period
        $endsAt = $sub->billing_cycle === 'yearly'
            ? now()->addYear()
            : now()->addMonth();

        $sub->update([
            'status'          => 'active',
            'last_payment_at' => now(),
            'ends_at'         => $endsAt,
        ]);

        if ($saleId && $amount > 0) {
            $payment = $this->recorder->recordPayPalPayment($sub, $sub->user, $saleId, $amount);
            if ($payment) {
                $this->billingNotifications->onPaymentSucceeded(
                    $sub->user,
                    $payment,
                    $sub->package?->name ?? 'Platform subscription',
                );
            }
        }
    }

    private function onPaymentFailed(?string $subscriptionId): void
    {
        if (! $subscriptionId) return;

        $sub = ConsultantSubscription::where('paypal_subscription_id', $subscriptionId)
            ->with('user', 'package:id,name')
            ->first();

        if (! $sub?->user) {
            return;
        }

        ConsultantSubscription::where('paypal_subscription_id', $subscriptionId)
            ->where('status', 'active')
            ->update(['status' => 'payment_declined']);

        $this->billingNotifications->onRenewalFailed(
            $sub->user,
            $sub->package?->name ?? 'Platform subscription',
            $sub,
            'billing_renewal_failed:paypal:' . $subscriptionId . ':' . now()->format('Y-m-d'),
        );
    }
}
