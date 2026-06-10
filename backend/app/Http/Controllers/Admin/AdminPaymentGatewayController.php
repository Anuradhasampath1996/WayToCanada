<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PaymentGatewaySetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\Account;
use Stripe\Stripe;

class AdminPaymentGatewayController extends Controller
{
    /**
     * GET /api/v1/admin/payment-gateways
     * Returns both gateways with masked keys (never exposes raw secrets).
     */
    public function index(): JsonResponse
    {
        $rows = PaymentGatewaySetting::all();

        $data = $rows->map(function (PaymentGatewaySetting $row) {
            $decryptedPublishable = PaymentGatewaySetting::decryptKey($row->publishable_key);
            $decryptedSecret      = PaymentGatewaySetting::decryptKey($row->secret_key);
            $decryptedWebhook     = PaymentGatewaySetting::decryptKey($row->webhook_id) ?? $row->webhook_id;

            return [
                'id'              => $row->id,
                'gateway'         => $row->gateway,
                'mode'            => $row->mode,
                'is_active'       => $row->is_active,
                'has_publishable' => ! is_null($decryptedPublishable),
                'has_secret'      => ! is_null($decryptedSecret),
                'has_webhook'     => ! empty($decryptedWebhook),
                // Masked previews so admin can confirm keys are set
                'publishable_key_preview' => PaymentGatewaySetting::maskKey($decryptedPublishable),
                'secret_key_preview'      => PaymentGatewaySetting::maskKey($decryptedSecret),
                'webhook_preview'           => PaymentGatewaySetting::maskKey($decryptedWebhook),
                'updated_at'      => $row->updated_at,
            ];
        });

        return response()->json(['data' => $data]);
    }

    /**
     * PUT /api/v1/admin/payment-gateways/{gateway}
     * Update mode, is_active, and optionally the keys.
     * Sending an empty string for a key leaves the existing value unchanged.
     */
    public function update(Request $request, string $gateway): JsonResponse
    {
        if (!in_array($gateway, ['stripe', 'paypal'])) {
            return response()->json(['message' => 'Invalid gateway.'], 422);
        }

        $validated = $request->validate([
            'mode'            => 'required|in:test,production',
            'is_active'       => 'required|boolean',
            'publishable_key' => 'nullable|string|max:512',
            'secret_key'      => 'nullable|string|max:512',
            'webhook_id'      => 'nullable|string|max:256',
        ]);

        $row = PaymentGatewaySetting::where('gateway', $gateway)->firstOrFail();

        $row->mode      = $validated['mode'];
        $row->is_active = $validated['is_active'];

        // Only update keys if a non-empty value was submitted
        if (!empty($validated['publishable_key'])) {
            $row->publishable_key = PaymentGatewaySetting::encryptKey($validated['publishable_key']);
        }
        if (!empty($validated['secret_key'])) {
            $row->secret_key = PaymentGatewaySetting::encryptKey($validated['secret_key']);
        }
        if (array_key_exists('webhook_id', $validated)) {
            $row->webhook_id = ! empty($validated['webhook_id'])
                ? PaymentGatewaySetting::encryptKey($validated['webhook_id'])
                : null;
        }

        $row->save();

        return response()->json(['message' => ucfirst($gateway) . ' settings saved successfully.']);
    }

    /**
     * DELETE /api/v1/admin/payment-gateways/{gateway}/keys
     * Clear stored keys for a gateway (reset without deleting the row).
     */
    public function clearKeys(string $gateway): JsonResponse
    {
        if (!in_array($gateway, ['stripe', 'paypal'])) {
            return response()->json(['message' => 'Invalid gateway.'], 422);
        }

        PaymentGatewaySetting::where('gateway', $gateway)->update([
            'publishable_key' => null,
            'secret_key'      => null,
            'webhook_id'      => null,
            'is_active'       => false,
        ]);

        return response()->json(['message' => ucfirst($gateway) . ' keys cleared.']);
    }

    /**
     * POST /api/v1/admin/payment-gateways/{gateway}/test
     * Verify Stripe API credentials by calling the Stripe Account API.
     */
    public function testConnection(Request $request, string $gateway): JsonResponse
    {
        if ($gateway !== 'stripe') {
            return response()->json(['message' => 'Only Stripe connection tests are supported.'], 422);
        }

        $validated = $request->validate([
            'secret_key' => 'nullable|string|max:512',
        ]);

        $row = PaymentGatewaySetting::where('gateway', 'stripe')->firstOrFail();

        $secret = ! empty($validated['secret_key'])
            ? $validated['secret_key']
            : PaymentGatewaySetting::decryptKey($row->secret_key);

        if (! $secret) {
            return response()->json([
                'success' => false,
                'message' => 'No secret key found. Enter your Stripe secret key and try again.',
            ], 422);
        }

        try {
            Stripe::setApiKey($secret);
            $account = Account::retrieve();

            $displayName = $account->business_profile->name
                ?? $account->settings->dashboard->display_name
                ?? null;

            $isLive = str_starts_with($secret, 'sk_live_');

            return response()->json([
                'success' => true,
                'message' => 'Stripe connection successful.',
                'account' => [
                    'id'           => $account->id,
                    'display_name' => $displayName,
                    'country'      => $account->country ?? null,
                    'livemode'     => $isLive,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Connection failed: ' . $e->getMessage(),
            ], 422);
        }
    }
}
