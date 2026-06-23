<?php

namespace App\Http\Controllers;

use App\Models\ConsultantMarketingOrder;
use App\Models\MarketingService;
use App\Services\CanadianBillingTaxService;
use App\Services\GstHstRatesService;
use App\Services\GstHstStripeTaxService;
use App\Services\StripeMarketingService;
use App\Services\StripePaymentFulfillmentService;
use App\Services\SubscriptionPaymentRecorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\Checkout\Session as StripeSession;

class ConsultantMarketingPaymentController extends Controller
{
    /** @return array<string, string> */
    private function billingRules(): array
    {
        return [
            'marketing_service_id'  => 'required|integer|exists:marketing_services,id',
            'billing_country'       => 'required|string|max:100',
            'billing_address_line1' => 'required|string|max:255',
            'billing_address_line2' => 'nullable|string|max:255',
            'billing_city'          => 'required|string|max:100',
            'billing_province'      => 'nullable|string|max:100',
            'billing_postal_code'   => 'nullable|string|max:20',
            'province'              => 'nullable|string|max:100',
        ];
    }

    public function myOrders(Request $request): JsonResponse
    {
        $orders = ConsultantMarketingOrder::where('user_id', $request->user()->id)
            ->whereIn('status', [ConsultantMarketingOrder::STATUS_PAID, ConsultantMarketingOrder::STATUS_ACTIVE])
            ->with('service:id,slug,name')
            ->latest('paid_at')
            ->get()
            ->map(fn (ConsultantMarketingOrder $o) => [
                'id'              => $o->id,
                'status'          => $o->status,
                'paid_at'         => $o->paid_at?->toIso8601String(),
                'service_slug'    => $o->service?->slug,
                'service_name'    => $o->service?->name,
            ]);

        return response()->json(['data' => $orders]);
    }

    public function taxQuote(Request $request, CanadianBillingTaxService $taxService): JsonResponse
    {
        $data = $request->validate($this->billingRules());

        $service  = MarketingService::where('is_active', true)->findOrFail($data['marketing_service_id']);
        $subtotal = (float) $service->price;

        if ($subtotal <= 0) {
            return response()->json(['message' => 'This service has no price configured yet.'], 422);
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

    public function createCheckoutSession(Request $request, CanadianBillingTaxService $taxService): JsonResponse
    {
        $data = $request->validate($this->billingRules());

        $user     = $request->user();
        $service  = MarketingService::where('is_active', true)->findOrFail($data['marketing_service_id']);
        $subtotal = (float) $service->price;

        if ($subtotal <= 0) {
            return response()->json(['message' => 'This service has no price configured yet.'], 422);
        }

        $alreadyOwned = ConsultantMarketingOrder::where('user_id', $user->id)
            ->where('marketing_service_id', $service->id)
            ->whereIn('status', [ConsultantMarketingOrder::STATUS_PAID, ConsultantMarketingOrder::STATUS_ACTIVE])
            ->exists();

        if ($alreadyOwned) {
            return response()->json(['message' => 'You have already purchased this marketing service.'], 422);
        }

        $baseUrl = rtrim(env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/');

        try {
            $billingAddress = $taxService->validateBillingAddress($data);
            $taxBreakdown   = $taxService->quote($subtotal, $billingAddress);

            $taxRateIds   = null;
            $provinceCode = $billingAddress['province'] ?? null;

            if ($taxBreakdown['tax_applicable'] && $provinceCode) {
                $ratesService     = new GstHstRatesService();
                $taxServiceStripe = new GstHstStripeTaxService($ratesService);
                $taxRateIds       = $taxServiceStripe->ensureTaxRates($provinceCode);
            }

            $user->fill([
                'company_address_line1' => $billingAddress['line1'],
                'company_address_line2' => $billingAddress['line2'] ?: null,
                'company_city'          => $billingAddress['city'],
                'company_province'      => $billingAddress['province'] ?? null,
                'company_postal_code'   => $billingAddress['postal_code'] ?: null,
                'company_country'       => $billingAddress['country'],
            ])->save();

            $stripeService = new StripeMarketingService();
            $result        = $stripeService->createCheckoutSession(
                $service,
                $user->id,
                $user->email,
                "{$baseUrl}/dashboard/marketing/return?session_id={CHECKOUT_SESSION_ID}",
                "{$baseUrl}/dashboard/marketing/{$service->slug}?checkout=cancelled",
                $provinceCode,
                $taxRateIds,
                $billingAddress['country'],
            );

            ConsultantMarketingOrder::create([
                'user_id'                    => $user->id,
                'marketing_service_id'       => $service->id,
                'status'                     => ConsultantMarketingOrder::STATUS_PENDING,
                'amount'                     => $subtotal,
                'billing_type'               => $service->billing_type,
                'province'                   => $provinceCode,
                'billing_country'            => $billingAddress['country'],
                'billing_address'            => $billingAddress,
                'tax_amount'                 => $taxBreakdown['total_tax'] ?? null,
                'stripe_checkout_session_id' => $result['session_id'],
            ]);

            return response()->json(array_merge($result, [
                'billing_address' => $billingAddress,
                'tax'             => $taxBreakdown,
            ]));
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    public function verifySession(
        Request $request,
        StripePaymentFulfillmentService $fulfillment,
        SubscriptionPaymentRecorder $recorder,
    ): JsonResponse {
        $data = $request->validate([
            'session_id' => 'required|string',
        ]);

        try {
            new StripeMarketingService();
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

        if (($session->metadata['type'] ?? '') !== 'marketing_service') {
            return response()->json(['message' => 'This checkout session is not for a marketing service.'], 422);
        }

        $userId = (int) ($session->client_reference_id ?? $session->metadata['user_id'] ?? 0);
        if ($request->user()->id !== $userId) {
            return response()->json(['message' => 'Session does not belong to this user.'], 403);
        }

        try {
            $result = $fulfillment->fulfillMarketingCheckout($session, $request->user());
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if (! empty($result['already'])) {
            return response()->json([
                'message' => 'Marketing service already activated.',
                'order'   => $result['order'],
            ]);
        }

        return response()->json([
            'message' => 'Payment confirmed. Our team will reach out to get started.',
            'order'   => $result['order'],
            'payment' => isset($result['payment']) ? $recorder->formatRecord($result['payment']) : null,
        ]);
    }
}
