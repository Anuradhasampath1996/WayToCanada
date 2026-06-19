<?php

namespace App\Http\Controllers;

use App\Models\ConsultantSubscription;
use App\Models\SubscriptionPackage;
use App\Services\PayPalService;
use App\Services\PayPalSubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/consultant/payment/paypal/config
    // Returns the PayPal client_id and environment so the frontend can load
    // the correct PayPal JS SDK.
    // ─────────────────────────────────────────────────────────────────────────

    public function paypalConfig(): JsonResponse
    {
        try {
            $service = new PayPalService();

            return response()->json([
                'client_id'   => $service->getClientId(),
                'environment' => $service->getEnvironment(), // 'sandbox' or 'production'
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/consultant/payment/paypal/create-order
    // Creates a PayPal order for the selected package + billing cycle and
    // returns the order_id so the frontend can pass it to the PayPal JS SDK.
    // ─────────────────────────────────────────────────────────────────────────

    public function createOrder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subscription_package_id' => 'required|integer|exists:subscription_packages,id',
            'billing_cycle'           => 'required|in:monthly,yearly',
        ]);

        /** @var SubscriptionPackage $package */
        $package = SubscriptionPackage::findOrFail($data['subscription_package_id']);

        $price = $data['billing_cycle'] === 'yearly'
            ? $package->yearly_price
            : $package->monthly_price;

        if (! $price || $price <= 0) {
            return response()->json([
                'message' => 'This package has no price configured for the selected billing cycle.',
            ], 422);
        }

        try {
            $service     = new PayPalService();
            $cycle       = ucfirst($data['billing_cycle']);
            $description = "{$package->name} — {$cycle} Subscription (RCICMASTER)";
            $order       = $service->createOrder($price, 'CAD', $description);

            return response()->json(['order_id' => $order['id']]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/consultant/payment/paypal/capture-order
    // Called after the user approves the payment in the PayPal popup.
    // Captures the payment, verifies it, then activates the subscription.
    // ─────────────────────────────────────────────────────────────────────────

    public function captureOrder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_id'                => 'required|string',
            'subscription_package_id' => 'required|integer|exists:subscription_packages,id',
            'billing_cycle'           => 'required|in:monthly,yearly',
        ]);

        try {
            $service  = new PayPalService();
            $captured = $service->captureOrder($data['order_id']);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        // Verify the capture was successful before granting access
        if (($captured['status'] ?? '') !== 'COMPLETED') {
            return response()->json([
                'message' => 'Payment was not completed. Status: ' . ($captured['status'] ?? 'unknown'),
            ], 422);
        }

        $user    = $request->user();
        $package = SubscriptionPackage::findOrFail($data['subscription_package_id']);
        $cycle   = $data['billing_cycle'];
        $endsAt  = $cycle === 'yearly' ? now()->addYear() : now()->addMonth();

        // Cancel any existing trial / active subscription for this user
        ConsultantSubscription::where('user_id', $user->id)
            ->whereIn('status', ['trial', 'active'])
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        $sub = ConsultantSubscription::create([
            'user_id'                 => $user->id,
            'subscription_package_id' => $package->id,
            'status'                  => 'active',
            'is_trial'                => false,
            'trial_ends_at'           => null,
            'starts_at'               => now(),
            'ends_at'                 => $endsAt,
            'billing_cycle'           => $cycle,
            'last_payment_at'         => now(),
            'cancelled_at'            => null,
            'paypal_order_id'         => $data['order_id'],
        ]);

        return response()->json([
            'message'      => 'Subscription activated successfully.',
            'subscription' => $sub->load('package'),
        ], 201);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/consultant/payment/paypal/subscription/create
    //
    // Creates a PayPal Billing Plan (if not yet cached) and then a PayPal
    // Subscription. Returns the approval_url the frontend should redirect to.
    // ─────────────────────────────────────────────────────────────────────────

    public function createSubscription(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subscription_package_id' => 'required|integer|exists:subscription_packages,id',
            'billing_cycle'           => 'required|in:monthly,yearly',
        ]);

        /** @var SubscriptionPackage $package */
        $package = SubscriptionPackage::findOrFail($data['subscription_package_id']);
        $cycle   = $data['billing_cycle'];

        // The return / cancel URLs land back in the consultant dashboard
        $baseUrl   = env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3001');
        $returnUrl = "{$baseUrl}/dashboard/subscribe/return";
        $cancelUrl = "{$baseUrl}/dashboard/subscribe/cancelled";

        try {
            $svc    = new PayPalSubscriptionService();
            $planId = $svc->ensurePlan($package, $cycle);
            $result = $svc->createSubscription($planId, $returnUrl, $cancelUrl);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        // Extract approval URL
        $approvalUrl = collect($result['links'] ?? [])
            ->firstWhere('rel', 'approve')['href'] ?? null;

        if (! $approvalUrl) {
            return response()->json(['message' => 'PayPal did not return an approval URL.'], 503);
        }

        return response()->json([
            'subscription_id' => $result['id'],
            'approval_url'    => $approvalUrl,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/consultant/payment/paypal/subscription/activate
    //
    // Called after the consultant returns from PayPal having approved the
    // subscription. Verifies with PayPal, then creates the DB record.
    // ─────────────────────────────────────────────────────────────────────────

    public function activateSubscription(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subscription_id'         => 'required|string',
            'subscription_package_id' => 'required|integer|exists:subscription_packages,id',
            'billing_cycle'           => 'required|in:monthly,yearly',
        ]);

        try {
            $svc  = new PayPalSubscriptionService();
            $info = $svc->getSubscription($data['subscription_id']);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        $status = $info['status'] ?? '';

        // APPROVED = user approved but first payment not yet collected
        // ACTIVE   = first payment already collected (some plans charge immediately)
        if (! in_array($status, ['APPROVED', 'ACTIVE'], true)) {
            return response()->json([
                'message' => "PayPal subscription status is '{$status}', expected APPROVED or ACTIVE.",
            ], 422);
        }

        $user    = $request->user();
        $package = SubscriptionPackage::findOrFail($data['subscription_package_id']);
        $cycle   = $data['billing_cycle'];

        // Determine ends_at from PayPal billing info, fall back to +1 period
        $nextBilling = $info['billing_info']['next_billing_time'] ?? null;
        $endsAt = $nextBilling
            ? \Carbon\Carbon::parse($nextBilling)
            : ($cycle === 'yearly' ? now()->addYear() : now()->addMonth());

        // Cancel any existing trial / active sub for this user
        ConsultantSubscription::where('user_id', $user->id)
            ->whereIn('status', ['trial', 'active'])
            ->each(function (ConsultantSubscription $old) use ($svc) {
                // Also cancel the PayPal subscription if one is attached
                if ($old->paypal_subscription_id) {
                    try {
                        $svc->cancelSubscription($old->paypal_subscription_id, 'Replaced by new subscription');
                    } catch (\Throwable) { /* best-effort */ }
                }
                $old->update(['status' => 'cancelled', 'cancelled_at' => now()]);
            });

        $sub = ConsultantSubscription::create([
            'user_id'                 => $user->id,
            'subscription_package_id' => $package->id,
            'status'                  => 'active',
            'is_trial'                => false,
            'trial_ends_at'           => null,
            'starts_at'               => now(),
            'ends_at'                 => $endsAt,
            'billing_cycle'           => $cycle,
            'last_payment_at'         => now(),
            'cancelled_at'            => null,
            'paypal_subscription_id'  => $data['subscription_id'],
        ]);

        return response()->json([
            'message'      => 'Subscription activated successfully.',
            'subscription' => $sub->load('package'),
        ], 201);
    }
}
