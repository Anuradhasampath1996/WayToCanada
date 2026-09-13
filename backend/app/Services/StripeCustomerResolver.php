<?php

namespace App\Services;

use App\Contracts\StripePlatformClient;
use App\Models\ConsultantSubscription;
use App\Models\User;

class StripeCustomerResolver
{
    public function __construct(private StripePlatformClient $stripe) {}

    public function customerIdForUser(User $user): ?string
    {
        $existing = ConsultantSubscription::where('user_id', $user->id)
            ->whereNotNull('stripe_customer_id')
            ->latest()
            ->value('stripe_customer_id');

        return $existing ?: null;
    }

    public function resolveOrCreate(User $user): string
    {
        $existing = $this->customerIdForUser($user);
        if ($existing) {
            return $existing;
        }

        $customer = $this->stripe->createCustomer((string) $user->email, $user->id);

        return (string) $customer->id;
    }
}
