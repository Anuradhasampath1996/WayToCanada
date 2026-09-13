<?php

namespace App\Services;

use App\Models\ConsultantSubscription;
use App\Models\User;

class StripePlatformSubscriptionGuard
{
    public function livePaidSubscription(User $user): ?ConsultantSubscription
    {
        return ConsultantSubscription::where('user_id', $user->id)
            ->whereNotNull('stripe_subscription_id')
            ->whereIn('status', ['active', 'past_due'])
            ->latest()
            ->first();
    }

    public function hasLivePaidStripeSubscription(User $user): bool
    {
        return $this->livePaidSubscription($user) !== null;
    }
}
