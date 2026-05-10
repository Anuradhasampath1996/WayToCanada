<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PaymentGatewaySetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

            return [
                'id'              => $row->id,
                'gateway'         => $row->gateway,
                'mode'            => $row->mode,
                'is_active'       => $row->is_active,
                'has_publishable' => !is_null($decryptedPublishable),
                'has_secret'      => !is_null($decryptedSecret),
                // Masked previews so admin can confirm keys are set
                'publishable_key_preview' => PaymentGatewaySetting::maskKey($decryptedPublishable),
                'secret_key_preview'      => PaymentGatewaySetting::maskKey($decryptedSecret),
                'webhook_id'      => $row->webhook_id,
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
            $row->webhook_id = $validated['webhook_id'] ?: null;
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
}
