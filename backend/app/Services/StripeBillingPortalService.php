<?php

namespace App\Services;

use App\Contracts\StripePlatformClient;
use App\Models\User;
use RuntimeException;

class StripeBillingPortalService
{
    public function __construct(
        private StripeCustomerResolver $customers,
        private StripePlatformSubscriptionGuard $guard,
        private StripePlatformClient $stripe,
    ) {}

    /** @return array{url: string} */
    public function createPaymentMethodSession(User $user): array
    {
        $customerId = $this->customers->customerIdForUser($user);
        if (! $customerId) {
            throw new RuntimeException('No Stripe customer is on file for this consultant.');
        }

        if (! $this->guard->hasLivePaidStripeSubscription($user) && ! $customerId) {
            throw new RuntimeException('No platform subscription customer to update.');
        }

        $base = rtrim((string) env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/');

        $session = $this->stripe->createBillingPortalSession([
            'customer'   => $customerId,
            'return_url' => $base.'/dashboard/billing',
            'flow_data'  => [
                'type' => 'payment_method_update',
            ],
        ]);

        return ['url' => (string) $session->url];
    }
}
