<?php

namespace App\Services;

use App\Models\ClientPaymentRequest;
use App\Models\ClientProfile;
use App\Models\ConsultantPaymentAccount;
use App\Models\User;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\Notifications\WorkspaceNotificationTriggers;
use App\Services\TrustLedger\TrustLedgerService;
use Stripe\Checkout\Session;

class ClientPaymentRequestService
{
    public function __construct(
        private ConsultantStripeConnectService $stripeConnect,
        private WorkspaceNotificationTriggers $notify,
        private ClientActivityTriggers $activity,
        private TrustLedgerService $trust,
    ) {}

    public function paymentAccountFor(User $consultant): ConsultantPaymentAccount
    {
        return ConsultantPaymentAccount::firstOrCreate(
            ['user_id' => $consultant->id],
            ['preferred_provider' => 'stripe']
        );
    }

    /**
     * @return array{session_id: string, url: string}
     */
    public function createStripeCheckout(ClientPaymentRequest $request, string $successUrl, string $cancelUrl): array
    {
        $account = $this->paymentAccountFor($request->consultant);

        if (! $account->hasStripe()) {
            throw new \RuntimeException('Consultant Stripe account is not ready to accept payments.');
        }

        new StripeService();

        $session = Session::create([
            'mode'       => 'payment',
            'line_items' => [[
                'price_data' => [
                    'currency'     => strtolower($request->currency),
                    'product_data' => [
                        'name' => $request->title,
                    ],
                    'unit_amount'  => (int) round((float) $request->amount * 100),
                ],
                'quantity' => 1,
            ]],
            'success_url'         => $successUrl,
            'cancel_url'          => $cancelUrl,
            'customer_email'      => $request->clientProfile->user->email ?? null,
            'client_reference_id' => (string) $request->id,
            'metadata'            => [
                'payment_request_id' => (string) $request->id,
                'type'               => 'client_payment_request',
            ],
        ], [
            'stripe_account' => $account->stripe_connect_account_id,
        ]);

        $request->update(['stripe_checkout_session_id' => $session->id]);

        return [
            'session_id' => $session->id,
            'url'        => $session->url,
        ];
    }

    public function markPaidFromConnectWebhook(object $session, string $connectedAccountId): ?ClientPaymentRequest
    {
        if (($session->metadata->type ?? '') !== 'client_payment_request') {
            return null;
        }

        $requestId = (int) ($session->metadata->payment_request_id ?? 0);
        if (! $requestId) {
            return null;
        }

        if (($session->payment_status ?? '') !== 'paid') {
            return null;
        }

        $paymentRequest = ClientPaymentRequest::with('consultant')->find($requestId);
        if (! $paymentRequest) {
            return null;
        }

        $account = ConsultantPaymentAccount::where('user_id', $paymentRequest->consultant_id)
            ->where('stripe_connect_account_id', $connectedAccountId)
            ->first();

        if (! $account) {
            throw new \RuntimeException('Connected account does not match payment request consultant.');
        }

        if ($paymentRequest->stripe_checkout_session_id && $paymentRequest->stripe_checkout_session_id !== ($session->id ?? '')) {
            return null;
        }

        return $this->markPaid($paymentRequest);
    }

    public function markPaid(ClientPaymentRequest $request): ClientPaymentRequest
    {
        if ($request->status === 'paid') {
            return $request;
        }

        $request->update([
            'status'  => 'paid',
            'paid_at' => now(),
        ]);

        $fresh = $request->fresh();
        $this->notify->onPaymentReceived($fresh);
        $fresh->loadMissing('clientProfile');
        if ($fresh->clientProfile) {
            $this->activity->onPaymentReceived($fresh->clientProfile, $fresh);
            if (($fresh->payment_purpose ?? 'general') === 'trust_deposit') {
                $this->trust->recordPaymentRequestDeposit($fresh);
            }
        }

        return $fresh;
    }

    public function verifyStripeSession(ClientPaymentRequest $request, string $sessionId): bool
    {
        if ($request->status === 'paid') {
            return true;
        }

        if ($request->stripe_checkout_session_id !== $sessionId) {
            return false;
        }

        new StripeService();
        $account = $this->paymentAccountFor($request->consultant);

        $session = Session::retrieve(
            $sessionId,
            [],
            ['stripe_account' => $account->stripe_connect_account_id]
        );

        if (($session->payment_status ?? '') === 'paid') {
            $this->markPaid($request);

            return true;
        }

        return false;
    }

    public function paypalPayUrl(ClientPaymentRequest $request, ConsultantPaymentAccount $account): string
    {
        $amount = number_format((float) $request->amount, 2, '.', '');
        $title  = urlencode($request->title);

        if ($account->paypal_me_username) {
            return "https://www.paypal.com/paypalme/{$account->paypal_me_username}/{$amount}CAD";
        }

        $business = urlencode($account->paypal_email ?? '');

        return "https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business={$business}&amount={$amount}&currency_code=CAD&item_name={$title}";
    }

    public function authorizeConsultant(User $user, ClientProfile $profile): void
    {
        if ((int) $profile->consultant_id !== (int) $user->id) {
            abort(403, 'You do not manage this client.');
        }
    }
}
