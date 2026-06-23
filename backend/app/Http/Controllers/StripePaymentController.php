<?php

namespace App\Http\Controllers;

use App\Models\ConsultantSubscription;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPaymentRecord;
use App\Services\CanadianBillingTaxService;
use App\Services\GstHstStripeTaxService;
use App\Services\GstHstRatesService;
use App\Services\StripePaymentFulfillmentService;
use App\Services\StripeSubscriptionService;
use App\Services\SubscriptionPaymentRecorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\Checkout\Session as StripeSession;
use Stripe\Invoice as StripeInvoice;
use Stripe\Subscription as StripeSubscription;

class StripePaymentController extends Controller
{
    private function billingRules(): array
    {
        return [
            'subscription_package_id' => 'required|integer|exists:subscription_packages,id',
            'billing_cycle'           => 'required|in:monthly,yearly',
            'billing_country'         => 'required|string|max:100',
            'billing_address_line1'   => 'required|string|max:255',
            'billing_address_line2'   => 'nullable|string|max:255',
            'billing_city'            => 'required|string|max:100',
            'billing_province'        => 'nullable|string|max:100',
            'billing_postal_code'     => 'nullable|string|max:20',
            'province'                => 'nullable|string|max:100',
        ];
    }

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
    public function taxQuote(Request $request, CanadianBillingTaxService $taxService): JsonResponse
    {
        $data = $request->validate($this->billingRules());

        $package = SubscriptionPackage::findOrFail($data['subscription_package_id']);
        $subtotal = $data['billing_cycle'] === 'yearly'
            ? (float) $package->yearly_price
            : (float) $package->monthly_price;

        if ($subtotal <= 0) {
            return response()->json(['message' => 'This package has no price for the selected billing cycle.'], 422);
        }

        try {
            $billingAddress = $taxService->validateBillingAddress($data);
            $tax            = $taxService->quote($subtotal, $billingAddress);

            return response()->json([
                'billing_address' => $billingAddress,
                'tax'             => $tax,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // POST /api/v1/consultant/payment/stripe/checkout-session
    public function createCheckoutSession(Request $request, CanadianBillingTaxService $taxService): JsonResponse
    {
        $data = $request->validate($this->billingRules());

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
            $billingAddress = $taxService->validateBillingAddress($data);
            $taxBreakdown   = $taxService->quote($subtotal, $billingAddress);

            $taxRateIds = null;
            $provinceCode = $billingAddress['province'] ?? null;

            if ($taxBreakdown['tax_applicable'] && $provinceCode) {
                $ratesService = new GstHstRatesService();
                $taxServiceStripe = new GstHstStripeTaxService($ratesService);
                $taxRateIds = $taxServiceStripe->ensureTaxRates($provinceCode);
            }

            $user->fill([
                'company_address_line1' => $billingAddress['line1'],
                'company_address_line2' => $billingAddress['line2'] ?: null,
                'company_city'          => $billingAddress['city'],
                'company_province'      => $billingAddress['province'] ?? null,
                'company_postal_code'   => $billingAddress['postal_code'] ?: null,
                'company_country'       => $billingAddress['country'],
            ])->save();

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
                $billingAddress['country'],
            );

            return response()->json(array_merge($result, [
                'billing_address' => $billingAddress,
                'tax'             => $taxBreakdown,
            ]));
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    // POST /api/v1/consultant/payment/stripe/verify-session
    public function verifySession(Request $request, StripePaymentFulfillmentService $fulfillment, SubscriptionPaymentRecorder $recorder): JsonResponse
    {
        $data = $request->validate([
            'session_id' => 'required|string',
        ]);

        try {
            new StripeSubscriptionService();
            $session = StripeSession::retrieve([
                'id'     => $data['session_id'],
                'expand' => ['subscription', 'invoice'],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Could not verify payment session.'], 503);
        }

        if (($session->payment_status ?? '') !== 'paid' && ($session->status ?? '') !== 'complete') {
            return response()->json([
                'message' => 'Payment was not completed. Status: ' . ($session->status ?? 'unknown'),
            ], 422);
        }

        $userId = (int) ($session->client_reference_id ?? $session->metadata['user_id'] ?? 0);
        if ($request->user()->id !== $userId) {
            return response()->json(['message' => 'Session does not belong to this user.'], 403);
        }

        if (($session->metadata['type'] ?? '') !== '' && ($session->metadata['type'] ?? '') !== null) {
            return response()->json(['message' => 'This session is not for a platform subscription.'], 422);
        }

        try {
            $result = $fulfillment->fulfillPlatformSubscriptionCheckout($session, $request->user());
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if (! empty($result['already'])) {
            return response()->json([
                'message'      => 'Subscription already activated.',
                'subscription' => $result['subscription']->load('package'),
            ]);
        }

        return response()->json([
            'message'      => 'Subscription activated successfully.',
            'subscription' => $result['subscription'],
            'payment'      => isset($result['payment']) ? $recorder->formatRecord($result['payment']) : null,
        ], 201);
    }
}
