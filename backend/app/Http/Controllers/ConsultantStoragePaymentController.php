<?php

namespace App\Http\Controllers;

use App\Models\ConsultantStorageAddon;
use App\Models\StorageAddonPackage;
use App\Services\GstHstCalculatorService;
use App\Services\GstHstRatesService;
use App\Services\GstHstStripeTaxService;
use App\Services\StripeStorageAddonService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\Checkout\Session as StripeSession;
use Stripe\Subscription as StripeSubscription;

class ConsultantStoragePaymentController extends Controller
{
    public function taxQuote(Request $request, GstHstRatesService $rates, GstHstCalculatorService $calculator): JsonResponse
    {
        $data = $request->validate([
            'storage_addon_package_id' => 'required|integer|exists:storage_addon_packages,id',
            'billing_cycle'            => 'required|in:monthly,yearly',
            'province'                 => 'required|string|max:100',
        ]);

        $provinceCode = $rates->normalizeProvinceCode($data['province']);
        if (! $provinceCode) {
            return response()->json(['message' => 'Invalid province.'], 422);
        }

        $package  = StorageAddonPackage::findOrFail($data['storage_addon_package_id']);
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

    public function createCheckoutSession(
        Request $request,
        GstHstRatesService $rates,
        GstHstCalculatorService $calculator
    ): JsonResponse {
        $data = $request->validate([
            'storage_addon_package_id' => 'required|integer|exists:storage_addon_packages,id',
            'billing_cycle'            => 'required|in:monthly,yearly',
            'province'                 => 'required|string|max:100',
        ]);

        $provinceCode = $rates->normalizeProvinceCode($data['province']);
        if (! $provinceCode) {
            return response()->json(['message' => 'Invalid province.'], 422);
        }

        $user    = $request->user();
        $package = StorageAddonPackage::where('is_active', true)->findOrFail($data['storage_addon_package_id']);
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

            $service = new StripeStorageAddonService();
            $result  = $service->createCheckoutSession(
                $package,
                $data['billing_cycle'],
                $user->id,
                $user->email,
                "{$baseUrl}/dashboard/storage/return?session_id={CHECKOUT_SESSION_ID}",
                "{$baseUrl}/dashboard/storage?upgrade=cancelled",
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

    public function verifySession(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_id' => 'required|string',
        ]);

        try {
            $service = new StripeStorageAddonService();
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

        if (($session->metadata['type'] ?? '') !== 'storage_addon') {
            return response()->json(['message' => 'This checkout session is not for storage upgrade.'], 422);
        }

        $packageId = (int) ($session->metadata['storage_addon_package_id'] ?? 0);
        $cycle     = $session->metadata['billing_cycle'] ?? 'monthly';
        $userId    = (int) ($session->client_reference_id ?? $session->metadata['user_id'] ?? 0);

        if ($request->user()->id !== $userId) {
            return response()->json(['message' => 'Session does not belong to this user.'], 403);
        }

        if (! $packageId) {
            return response()->json(['message' => 'Missing package metadata on checkout session.'], 422);
        }

        $existing = ConsultantStorageAddon::where('stripe_checkout_session_id', $session->id)->first();
        if ($existing) {
            return response()->json([
                'message' => 'Storage addon already activated.',
                'addon'   => $existing->load('package'),
            ]);
        }

        $stripeSub = $session->subscription;
        if (is_string($stripeSub)) {
            $stripeSub = StripeSubscription::retrieve($stripeSub);
        }

        $package = StorageAddonPackage::findOrFail($packageId);
        $endsAt  = $stripeSub?->current_period_end
            ? \Carbon\Carbon::createFromTimestamp($stripeSub->current_period_end)
            : ($cycle === 'yearly' ? now()->addYear() : now()->addMonth());

        $addon = ConsultantStorageAddon::create([
            'user_id'                    => $userId,
            'storage_addon_package_id'   => $package->id,
            'status'                     => 'active',
            'billing_cycle'              => $cycle,
            'extra_bytes'                => $package->extraBytes(),
            'starts_at'                  => now(),
            'ends_at'                    => $endsAt,
            'stripe_customer_id'         => is_string($session->customer) ? $session->customer : ($session->customer->id ?? null),
            'stripe_subscription_id'     => is_string($stripeSub) ? $stripeSub : ($stripeSub?->id),
            'stripe_checkout_session_id' => $session->id,
        ]);

        return response()->json([
            'message' => 'Extra storage unlocked successfully.',
            'addon'   => $addon->load('package'),
        ], 201);
    }
}
