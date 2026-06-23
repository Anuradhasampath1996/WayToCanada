<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\ClientPaymentRequest;
use App\Models\ClientProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientPaymentRequestController extends Controller
{
    /**
     * GET /api/v1/client/payment-requests
     */
    public function index(Request $request): JsonResponse
    {
        $profile = ClientProfile::where('user_id', $request->user()->id)->first();

        if (! $profile) {
            return response()->json(['data' => []]);
        }

        $items = ClientPaymentRequest::where('client_profile_id', $profile->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (ClientPaymentRequest $r) => $this->format($r));

        return response()->json(['data' => $items]);
    }

    private function format(ClientPaymentRequest $request): array
    {
        return [
            'id'              => $request->id,
            'title'           => $request->title,
            'description'     => $request->description,
            'amount'          => (float) $request->amount,
            'currency'        => $request->currency,
            'provider'        => $request->provider,
            'payment_purpose' => $request->payment_purpose ?? 'general',
            'status'          => $request->status,
            'pay_url'         => $request->publicUrl(),
            'is_payable'      => $request->isPayable(),
            'paid_at'         => $request->paid_at?->toIso8601String(),
            'sent_at'         => $request->sent_at?->toIso8601String(),
            'created_at'      => $request->created_at?->toIso8601String(),
        ];
    }
}
