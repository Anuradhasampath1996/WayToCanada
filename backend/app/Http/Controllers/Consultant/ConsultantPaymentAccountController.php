<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ConsultantPaymentAccount;
use App\Services\ClientPaymentRequestService;
use App\Services\ConsultantStripeConnectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantPaymentAccountController extends Controller
{
    public function __construct(
        private ConsultantStripeConnectService $stripeConnect,
        private ClientPaymentRequestService $payments,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $account = $this->payments->paymentAccountFor($request->user());

        if ($account->stripe_connect_account_id) {
            try {
                $account = $this->stripeConnect->syncAccountStatus($account);
            } catch (\Throwable) {
                // Stripe may be unavailable in dev — return cached status.
            }
        }

        return response()->json($this->formatAccount($account));
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'paypal_email'        => 'nullable|email|max:200',
            'paypal_me_username'  => 'nullable|string|max:100',
            'interac_email'       => 'nullable|email|max:200',
            'preferred_provider'  => 'nullable|in:stripe,paypal,interac',
        ]);

        $account = $this->payments->paymentAccountFor($request->user());
        $account->update($data);

        return response()->json($this->formatAccount($account->fresh()));
    }

    public function stripeConnect(Request $request): JsonResponse
    {
        $consultantUrl = rtrim(env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/');
        $returnUrl     = $consultantUrl . '/dashboard/account?stripe_connect=return';
        $refreshUrl    = $consultantUrl . '/dashboard/account?stripe_connect=refresh';

        try {
            $link = $this->stripeConnect->createOnboardingLink(
                $request->user(),
                $returnUrl,
                $refreshUrl,
            );
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Could not start Stripe Connect onboarding: ' . $e->getMessage(),
            ], 422);
        }

        return response()->json($link);
    }

    public function stripeSync(Request $request): JsonResponse
    {
        $account = $this->payments->paymentAccountFor($request->user());

        if (! $account->stripe_connect_account_id) {
            return response()->json(['message' => 'No Stripe account linked yet.'], 404);
        }

        try {
            $account = $this->stripeConnect->syncAccountStatus($account);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($this->formatAccount($account));
    }

    public function stripeDashboard(Request $request): JsonResponse
    {
        $account = $this->payments->paymentAccountFor($request->user());

        try {
            $url = $this->stripeConnect->createDashboardLink($account);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if (! $url) {
            return response()->json(['message' => 'Stripe account not found.'], 404);
        }

        return response()->json(['url' => $url]);
    }

    private function formatAccount(ConsultantPaymentAccount $account): array
    {
        return [
            'stripe_connect_account_id' => $account->stripe_connect_account_id,
            'stripe_charges_enabled'    => $account->stripe_charges_enabled,
            'stripe_details_submitted'  => $account->stripe_details_submitted,
            'stripe_ready'              => $account->hasStripe(),
            'paypal_email'              => $account->paypal_email,
            'paypal_me_username'        => $account->paypal_me_username,
            'paypal_ready'              => $account->hasPaypal(),
            'interac_email'             => $account->interac_email,
            'interac_ready'             => $account->hasInterac(),
            'preferred_provider'        => $account->preferred_provider,
        ];
    }
}
