<?php

namespace Tests\Unit;

use App\Services\StripeSubscriptionStatusMapper;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class StripeSubscriptionStatusMapperTest extends TestCase
{
    #[DataProvider('stripeStatusProvider')]
    public function test_maps_stripe_status_consistently(?string $stripe, string $expected): void
    {
        $mapper = new StripeSubscriptionStatusMapper();

        $this->assertSame($expected, $mapper->toLocal($stripe, 'active'));
    }

    public function test_past_due_is_not_mapped_to_cancelled(): void
    {
        $mapper = new StripeSubscriptionStatusMapper();

        $this->assertSame('past_due', $mapper->toLocal('past_due'));
        $this->assertFalse($mapper->isTerminalLocal('past_due'));
        $this->assertTrue($mapper->isLiveStripeStatus('past_due'));
    }

    /** @return array<string, array{0: ?string, 1: string}> */
    public static function stripeStatusProvider(): array
    {
        return [
            'active' => ['active', 'active'],
            'trialing' => ['trialing', 'active'],
            'past_due' => ['past_due', 'past_due'],
            'incomplete' => ['incomplete', 'past_due'],
            'unpaid' => ['unpaid', 'cancelled'],
            'incomplete_expired' => ['incomplete_expired', 'cancelled'],
            'canceled' => ['canceled', 'cancelled'],
            'unknown keeps fallback' => ['foo', 'active'],
        ];
    }
}
