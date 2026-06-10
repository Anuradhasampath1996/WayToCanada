<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ConsultantSubscription;
use App\Services\StripeSubscriptionSyncService;
use App\Services\StripeTestClockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminStripeTestController extends Controller
{
    // GET /api/v1/admin/stripe-test/status
    public function status(): JsonResponse
    {
        try {
            $service = new StripeTestClockService();

            return response()->json($service->status());
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    // POST /api/v1/admin/stripe-test/clock/enable
    public function enableClock(Request $request): JsonResponse
    {
        $data = $request->validate([
            'use_for_checkouts' => 'sometimes|boolean',
        ]);

        try {
            $service = new StripeTestClockService();
            $result  = $service->enable($data['use_for_checkouts'] ?? true);

            return response()->json([
                'message' => 'Stripe Test Clock enabled. New consultant checkouts will use simulated time.',
                'clock'   => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // POST /api/v1/admin/stripe-test/clock/disable
    public function disableClock(): JsonResponse
    {
        try {
            $service = new StripeTestClockService();
            $result  = $service->disable();

            return response()->json([
                'message' => 'Test Clock disabled for new checkouts.',
                'clock'   => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // POST /api/v1/admin/stripe-test/clock/advance
    public function advanceClock(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cycle' => 'required|in:monthly,yearly',
        ]);

        try {
            $clockService = new StripeTestClockService();
            $advance      = $clockService->advance($data['cycle']);

            return response()->json($advance);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // POST /api/v1/admin/stripe-test/subscriptions/sync
    public function syncSubscriptions(): JsonResponse
    {
        try {
            $service = new StripeSubscriptionSyncService();
            $result  = $service->syncAllActive();

            return response()->json([
                'message' => "Synced {$result['synced']} subscription(s) from Stripe.",
                ...$result,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // POST /api/v1/admin/stripe-test/subscriptions/{subscription}/sync
    public function syncOne(ConsultantSubscription $subscription): JsonResponse
    {
        try {
            $service = new StripeSubscriptionSyncService();
            $fresh   = $service->sync($subscription);

            return response()->json([
                'message'      => 'Subscription synced from Stripe.',
                'subscription' => $fresh,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
