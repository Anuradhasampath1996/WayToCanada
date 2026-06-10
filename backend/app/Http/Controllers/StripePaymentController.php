<?php

namespace App\Http\Controllers;

use App\Models\ConsultantSubscription;
use App\Models\SubscriptionPackage;
use App\Services\GstHstCalculatorService;
use App\Services\GstHstRatesService;
use App\Services\GstHstStripeTaxService;
use App\Services\StripeSubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\Checkout\Session as StripeSession;
use Stripe\Subscription as StripeSubscription;

class StripePaymentController extends Controller
{
    // GET /api/v1/consultant/payment/stripe/config
    public function config(): JsonResponse
    {
        try {
            $service = new StripeSubscriptionService();

            return response()->json([
                'publishable_key' => $service->getPublishableKey(),
                'test_mode'       => $service->isTestMode(),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    // GET /api/v1/consultant/payment/stripe/tax-quote
    public function taxQuote(Request $request, GstHstRatesService $rates, GstHstCalculatorService $calculator): JsonResponse
    {
        $data = $request->validate([
            'subscription_package_id' => 'required|integer|exists:subscription_packages,id',
            'billing_cycle'           => 'required|in:monthly,yearly',
            'province'                => 'required|string|max:100',
        ]);

        $provinceCode = $rates->normalizeProvinceCode($data['province']);
        if (! $provinceCode) {
            return response()->json(['message' => 'Invalid province. Use a 2-letter code (e.g. ON) or full name (e.g. Ontario).'], 422);
        }

        $package = SubscriptionPackage::findOrFail($data['subscription_package_id']);
        $subtotal = $data['billing_cycle'] === 'yearly'
            ? (float) $package->yearly_price
            : (float) $package->monthly_price;

        if ($subtotal <= 0) {
            return response()->json(['message' => 'This package has no price for the selected billing cycle.'], 422);
        }

        try {
            return response()->json([
                'province' => $provinceCode,
                'tax'      => $calculator->calculate($subtotal, $provinceCode),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // POST /api/v1/consultant/payment/stripe/checkout-session
    public function createCheckoutSession(Request $request, GstHstRatesService $rates, GstHstCalculatorService $calculator): JsonResponse
    {
        $data = $request->validate([
            'subscription_package_id' => 'required|integer|exists:subscription_packages,id',
            'billing_cycle'           => 'required|in:monthly,yearly',
            'province'                => 'required|string|max:100',
        ]);

        $provinceCode = $rates->normalizeProvinceCode($data['province']);
        if (! $provinceCode) {
            return response()->json(['message' => 'Invalid province. Use a 2-letter code (e.g. ON) or full name (e.g. Ontario).'], 422);
        }

        $user    = $request->user();
        $package = SubscriptionPackage::findOrFail($data['subscription_package_id']);
        $subtotal = $data['billing_cycle'] === 'yearly'
            ? (float) $package->yearly_price
            : (float) $package->monthly_price;

        if ($subtotal <= 0) {
            return response()->json(['message' => 'This package has no price for the selected billing cycle.'], 422);
        }

        $baseUrl = rtrim(env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/');

        try {
            $taxBreakdown = $calculator->calculate($subtotal, $provinceCode);
            $taxService   = new GstHstStripeTaxService($rates);
            $taxRateIds   = $taxService->ensureTaxRates($provinceCode);

            $service = new StripeSubscriptionService();
            $result  = $service->createCheckoutSession(
                $package,
                $data['billing_cycle'],
                $user->id,
                $user->email,
                "{$baseUrl}/dashboard/subscribe/return?session_id={CHECKOUT_SESSION_ID}",
                "{$baseUrl}/dashboard/subscribe/cancelled",
                $provinceCode,
                $taxRateIds,
            );

            return response()->json(array_merge($result, [
                'province' => $provinceCode,
                'tax'      => $taxBreakdown,
            ]));
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    // POST /api/v1/consultant/payment/stripe/verify-session
    public function verifySession(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_id' => 'required|string',
        ]);

        try {
            $service = new StripeSubscriptionService();
            $session = StripeSession::retrieve([
                'id'     => $data['session_id'],
                'expand' => ['subscription'],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        if (($session->payment_status ?? '') !== 'paid' && ($session->status ?? '') !== 'complete') {
            return response()->json([
                'message' => 'Payment was not completed. Status: ' . ($session->status ?? 'unknown'),
            ], 422);
        }

        $packageId = (int) ($session->metadata['subscription_package_id'] ?? 0);
        $cycle     = $session->metadata['billing_cycle'] ?? 'monthly';
        $userId    = (int) ($session->client_reference_id ?? $session->metadata['user_id'] ?? 0);

        if ($request->user()->id !== $userId) {
            return response()->json(['message' => 'Session does not belong to this user.'], 403);
        }

        if (! $packageId) {
            return response()->json(['message' => 'Missing package metadata on checkout session.'], 422);
        }

        $existing = ConsultantSubscription::where('stripe_checkout_session_id', $session->id)->first();
        if ($existing) {
            return response()->json([
                'message'      => 'Subscription already activated.',
                'subscription' => $existing->load('package'),
            ]);
        }

        $stripeSub = $session->subscription;
        if (is_string($stripeSub)) {
            $stripeSub = StripeSubscription::retrieve($stripeSub);
        }

        $package = SubscriptionPackage::findOrFail($packageId);
        $endsAt  = $stripeSub?->current_period_end
            ? \Carbon\Carbon::createFromTimestamp($stripeSub->current_period_end)
            : ($cycle === 'yearly' ? now()->addYear() : now()->addMonth());

        ConsultantSubscription::where('user_id', $userId)
            ->whereIn('status', ['trial', 'active'])
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        $sub = ConsultantSubscription::create([
            'user_id'                   => $userId,
            'subscription_package_id'   => $package->id,
            'status'                    => 'active',
            'is_trial'                  => false,
            'trial_ends_at'             => null,
            'starts_at'                 => now(),
            'ends_at'                   => $endsAt,
            'billing_cycle'             => $cycle,
            'last_payment_at'           => now(),
            'cancelled_at'              => null,
            'stripe_customer_id'        => is_string($session->customer) ? $session->customer : ($session->customer->id ?? null),
            'stripe_subscription_id'    => is_string($stripeSub) ? $stripeSub : ($stripeSub?->id),
            'stripe_checkout_session_id' => $session->id,
        ]);

        return response()->json([
            'message'      => 'Subscription activated successfully.',
            'subscription' => $sub->load('package'),
        ], 201);
    }
}
