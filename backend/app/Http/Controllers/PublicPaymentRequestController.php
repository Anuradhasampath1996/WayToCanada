<?php

namespace App\Http\Controllers;

use App\Models\ClientPaymentRequest;
use App\Services\ClientPaymentRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicPaymentRequestController extends Controller
{
    public function __construct(
        private ClientPaymentRequestService $payments,
    ) {}

    public function show(string $token): JsonResponse
    {
        $request = ClientPaymentRequest::with(['consultant', 'clientProfile.user'])
            ->where('token', $token)
            ->firstOrFail();

        $account = $this->payments->paymentAccountFor($request->consultant);

        return response()->json([
            'id'          => $request->id,
            'title'       => $request->title,
            'description' => $request->description,
            'amount'      => (float) $request->amount,
            'currency'    => $request->currency,
            'provider'    => $request->provider,
            'status'      => $request->status,
            'is_payable'  => $request->isPayable(),
            'consultant'  => [
                'name'         => $request->consultant->name,
                'company_name' => $request->consultant->company_name,
            ],
            'client_name' => $request->clientProfile->user->name ?? null,
            'interac_email' => $request->provider === 'interac' ? $account->interac_email : null,
        ]);
    }

    public function checkout(Request $request, string $token): JsonResponse
    {
        $paymentRequest = ClientPaymentRequest::with(['consultant', 'clientProfile.user'])
            ->where('token', $token)
            ->firstOrFail();

        if (! $paymentRequest->isPayable()) {
            return response()->json(['message' => 'This payment request is no longer active.'], 422);
        }

        $publicUrl = rtrim(env('PUBLIC_DASHBOARD_URL', env('PUBLIC_FRONTEND_URL', 'http://localhost:3002')), '/');

        if ($paymentRequest->provider === 'stripe') {
            try {
                $session = $this->payments->createStripeCheckout(
                    $paymentRequest,
                    $publicUrl . '/pay/' . $token . '?paid=1&session_id={CHECKOUT_SESSION_ID}',
                    $publicUrl . '/pay/' . $token . '?cancelled=1',
                );
            } catch (\Throwable $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }

            return response()->json(['checkout_url' => $session['url']]);
        }

        if ($paymentRequest->provider === 'paypal') {
            $account = $this->payments->paymentAccountFor($paymentRequest->consultant);

            return response()->json([
                'checkout_url' => $this->payments->paypalPayUrl($paymentRequest, $account),
                'manual_confirm' => true,
            ]);
        }

        if ($paymentRequest->provider === 'interac') {
            $account = $this->payments->paymentAccountFor($paymentRequest->consultant);

            return response()->json([
                'interac_email'  => $account->interac_email,
                'manual_confirm' => true,
            ]);
        }

        return response()->json(['message' => 'Unsupported payment provider.'], 422);
    }

    public function confirmSent(Request $request, string $token): JsonResponse
    {
        $paymentRequest = ClientPaymentRequest::where('token', $token)->firstOrFail();

        if (! $paymentRequest->isPayable()) {
            return response()->json(['message' => 'This payment request is no longer active.'], 422);
        }

        if (! in_array($paymentRequest->provider, ['paypal', 'interac'], true)) {
            return response()->json(['message' => 'Manual confirmation is not required for this payment method.'], 422);
        }

        $paymentRequest->update(['status' => 'awaiting_confirmation']);

        return response()->json([
            'message' => 'Thank you. Your consultant will confirm once payment is received.',
            'status'  => $paymentRequest->status,
        ]);
    }

    public function verify(Request $request, string $token): JsonResponse
    {
        $paymentRequest = ClientPaymentRequest::where('token', $token)->firstOrFail();

        $sessionId = $request->input('session_id');
        if (! $sessionId) {
            return response()->json(['message' => 'session_id is required.'], 422);
        }

        try {
            $paid = $this->payments->verifyStripeSession($paymentRequest, $sessionId);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'paid'   => $paid,
            'status' => $paymentRequest->fresh()->status,
        ]);
    }
}
