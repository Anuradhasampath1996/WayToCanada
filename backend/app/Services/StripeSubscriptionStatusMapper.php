<?php

namespace App\Services;

class StripeSubscriptionStatusMapper
{
    public const LOCAL_TRIAL = 'trial';

    public const LOCAL_ACTIVE = 'active';

    public const LOCAL_PAST_DUE = 'past_due';

    public const LOCAL_EXPIRED = 'expired';

    public const LOCAL_CANCELLED = 'cancelled';

    public const LOCAL_PAYMENT_DECLINED = 'payment_declined';

    /**
     * Map a Stripe subscription status to the local consultant_subscriptions.status.
     */
    public function toLocal(?string $stripeStatus, ?string $fallback = self::LOCAL_ACTIVE): string
    {
        return match ($stripeStatus) {
            'active', 'trialing' => self::LOCAL_ACTIVE,
            'past_due', 'incomplete' => self::LOCAL_PAST_DUE,
            'unpaid', 'incomplete_expired', 'canceled' => self::LOCAL_CANCELLED,
            default => $fallback ?? self::LOCAL_ACTIVE,
        };
    }

    public function isTerminalLocal(string $localStatus): bool
    {
        return in_array($localStatus, [self::LOCAL_CANCELLED, self::LOCAL_EXPIRED], true);
    }

    public function isLiveStripeStatus(?string $stripeStatus): bool
    {
        return in_array($stripeStatus, ['active', 'trialing', 'past_due', 'incomplete', 'unpaid'], true);
    }

    /**
     * @return list<string>
     */
    public function liveLocalStatuses(): array
    {
        return [self::LOCAL_TRIAL, self::LOCAL_ACTIVE, self::LOCAL_PAST_DUE];
    }
}
