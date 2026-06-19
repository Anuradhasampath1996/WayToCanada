<?php

namespace App\Http\Controllers;

use App\Models\ConsultantMarketingOrder;
use App\Models\MarketingService;
use App\Services\GstHstCalculatorService;
use App\Services\GstHstRatesService;
use App\Services\GstHstStripeTaxService;
use App\Services\StripeMarketingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\Checkout\Session as StripeSession;

class ConsultantMarketingPaymentController extends Controller
{
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

    public function taxQuote(Request $request, GstHstRatesService $rates, GstHstCalculatorService $calculator): JsonResponse
    {
        $data = $request->validate([
            'marketing_service_id' => 'required|integer|exists:marketing_services,id',
            'province'             => 'required|string|max:100',
        ]);

        $provinceCode = $rates->normalizeProvinceCode($data['province']);
        if (! $provinceCode) {
            return response()->json(['message' => 'Invalid province.'], 422);
        }

        $service  = MarketingService::where('is_active', true)->findOrFail($data['marketing_service_id']);
        $subtotal = (float) $service->price;

        if ($subtotal <= 0) {
            return response()->json(['message' => 'This service has no price configured yet.'], 422);
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

    public function createCheckoutSession(
        Request $request,
        GstHstRatesService $rates,
        GstHstCalculatorService $calculator
    ): JsonResponse {
        $data = $request->validate([
            'marketing_service_id' => 'required|integer|exists:marketing_services,id',
            'province'             => 'required|string|max:100',
        ]);

        $provinceCode = $rates->normalizeProvinceCode($data['province']);
        if (! $provinceCode) {
            return response()->json(['message' => 'Invalid province.'], 422);
        }

        $user    = $request->user();
        $service = MarketingService::where('is_active', true)->findOrFail($data['marketing_service_id']);
        $subtotal = (float) $service->price;

        if ($subtotal <= 0) {
            return response()->json(['message' => 'This service has no price configured yet.'], 422);
        }

        $baseUrl = rtrim(env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/');

        try {
            $taxBreakdown = $calculator->calculate($subtotal, $provinceCode);
            $taxService   = new GstHstStripeTaxService($rates);
            $taxRateIds   = $taxService->ensureTaxRates($provinceCode);

            $stripeService = new StripeMarketingService();
            $result = $stripeService->createCheckoutSession(
                $service,
                $user->id,
                $user->email,
                "{$baseUrl}/dashboard/marketing/return?session_id={CHECKOUT_SESSION_ID}",
                "{$baseUrl}/dashboard/marketing/{$service->slug}?checkout=cancelled",
                $provinceCode,
                $taxRateIds,
            );

            ConsultantMarketingOrder::create([
                'user_id'                    => $user->id,
                'marketing_service_id'       => $service->id,
                'status'                     => ConsultantMarketingOrder::STATUS_PENDING,
                'amount'                     => $subtotal,
                'billing_type'               => $service->billing_type,
                'province'                   => $provinceCode,
                'tax_amount'                 => $taxBreakdown['total_tax'] ?? null,
                'stripe_checkout_session_id' => $result['session_id'],
            ]);

            return response()->json(array_merge($result, [
                'province' => $provinceCode,
                'tax'      => $taxBreakdown,
            ]));
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    public function verifySession(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_id' => 'required|string',
        ]);

        try {
            new StripeMarketingService();
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

        if (($session->metadata['type'] ?? '') !== 'marketing_service') {
            return response()->json(['message' => 'This checkout session is not for a marketing service.'], 422);
        }

        $serviceId = (int) ($session->metadata['marketing_service_id'] ?? 0);
        $userId    = (int) ($session->client_reference_id ?? $session->metadata['user_id'] ?? 0);

        if ($request->user()->id !== $userId) {
            return response()->json(['message' => 'Session does not belong to this user.'], 403);
        }

        $order = ConsultantMarketingOrder::where('stripe_checkout_session_id', $session->id)->first();

        if ($order && in_array($order->status, [ConsultantMarketingOrder::STATUS_PAID, ConsultantMarketingOrder::STATUS_ACTIVE], true)) {
            return response()->json([
                'message' => 'Marketing service already activated.',
                'order'   => $order->load('service'),
            ]);
        }

        if (! $order) {
            $order = ConsultantMarketingOrder::create([
                'user_id'                    => $userId,
                'marketing_service_id'       => $serviceId,
                'status'                     => ConsultantMarketingOrder::STATUS_PENDING,
                'amount'                     => 0,
                'billing_type'               => $session->metadata['billing_type'] ?? MarketingService::BILLING_ONE_TIME,
                'stripe_checkout_session_id' => $session->id,
            ]);
        }

        $billingType = $session->metadata['billing_type'] ?? MarketingService::BILLING_ONE_TIME;
        $status      = $billingType === MarketingService::BILLING_MONTHLY
            ? ConsultantMarketingOrder::STATUS_ACTIVE
            : ConsultantMarketingOrder::STATUS_PAID;

        $order->update([
            'status'                  => $status,
            'paid_at'                 => now(),
            'starts_at'               => now(),
            'stripe_subscription_id'  => $session->subscription?->id ?? $session->subscription ?? null,
        ]);

        return response()->json([
            'message' => 'Payment confirmed. Our team will reach out to get started.',
            'order'   => $order->fresh()->load('service'),
        ]);
    }
}
