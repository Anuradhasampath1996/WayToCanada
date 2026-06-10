<?php

namespace App\Http\Controllers;

use App\Models\ConsultantSubscription;
use App\Models\PaymentGatewaySetting;
use App\Services\StripeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Subscription as StripeSubscription;
use Stripe\Webhook;

class StripeWebhookController extends Controller
{
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
                return response()->json(['received' => true]);
            }

            $event = Webhook::constructEvent($payload, $sigHeader, $secret);
        } catch (\Throwable $e) {
            Log::error('[Stripe] Webhook verification failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Invalid signature'], 400);
        }

        $type = $event->type;
        $data = $event->data->object;

        Log::info('[Stripe] Webhook', ['type' => $type]);

        match ($type) {
            'checkout.session.completed' => $this->handleCheckoutCompleted($data),
            'invoice.paid'               => $this->handleInvoicePaid($data),
            'customer.subscription.deleted',
            'customer.subscription.updated' => $this->handleSubscriptionChange($data),
            default => null,
        };

        return response()->json(['received' => true]);
    }

    private function handleCheckoutCompleted(object $session): void
    {
        if (($session->mode ?? '') !== 'subscription') {
            return;
        }

        $existing = ConsultantSubscription::where('stripe_checkout_session_id', $session->id)->first();
        if ($existing) {
            return;
        }

        // Initial activation is handled by verify-session on return URL.
        // This handler is a backup if the user closes the browser before return.
        Log::info('[Stripe] checkout.session.completed — awaiting verify-session or manual sync', [
            'session_id' => $session->id,
        ]);
    }

    private function handleInvoicePaid(object $invoice): void
    {
        $stripeSubId = $invoice->subscription ?? null;
        if (! $stripeSubId) {
            return;
        }

        $updates = [
            'status'          => 'active',
            'last_payment_at' => now(),
        ];

        try {
            new StripeService();
            $stripeSub = StripeSubscription::retrieve($stripeSubId);
            if ($stripeSub->current_period_end) {
                $updates['ends_at'] = \Carbon\Carbon::createFromTimestamp($stripeSub->current_period_end);
            }
        } catch (\Throwable $e) {
            Log::warning('[Stripe] Could not fetch subscription for invoice.paid', [
                'subscription_id' => $stripeSubId,
                'error'           => $e->getMessage(),
            ]);
        }

        ConsultantSubscription::where('stripe_subscription_id', $stripeSubId)
            ->update($updates);
    }

    private function handleSubscriptionChange(object $subscription): void
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

        if ($status === 'active' && isset($subscription->current_period_end)) {
            $sub->update([
                'status'  => 'active',
                'ends_at' => \Carbon\Carbon::createFromTimestamp($subscription->current_period_end),
            ]);
        }
    }
}
