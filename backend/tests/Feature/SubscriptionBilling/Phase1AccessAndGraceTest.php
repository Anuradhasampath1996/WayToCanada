<?php

namespace Tests\Feature\SubscriptionBilling;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesSubscriptionFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class Phase1AccessAndGraceTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesLmsDatabase;
    use CreatesSubscriptionFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wipeLmsTestDatabase();
        $this->seedBillingRoles();
        config(['subscription.grace_days' => 3]);
    }

    public function test_past_due_status_persists_in_the_database(): void
    {
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $sub = $this->makeSubscription($user, $package, [
            'status' => 'past_due',
            'past_due_started_at' => now(),
            'stripe_subscription_id' => 'sub_live_1',
        ]);

        $this->assertDatabaseHas('consultant_subscriptions', [
            'id' => $sub->id,
            'status' => 'past_due',
        ]);

        $this->assertTrue($sub->fresh()->isCurrentlyActive());
        $this->assertTrue($sub->fresh()->isWithinGracePeriod());
    }

    public function test_grace_period_keeps_workspace_access(): void
    {
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $this->makeSubscription($user, $package, [
            'status' => 'past_due',
            'past_due_started_at' => now()->subDay(),
            'stripe_subscription_id' => 'sub_live_1',
        ]);

        $this->actingAsConsultant($user);

        $this->getJson('/api/v1/consultant/subscription')
            ->assertOk()
            ->assertJsonPath('is_active', true)
            ->assertJsonPath('in_grace', true)
            ->assertJsonPath('subscription.status', 'past_due');
    }

    public function test_grace_period_expiry_blocks_access_without_cancelling(): void
    {
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $this->makeSubscription($user, $package, [
            'status' => 'past_due',
            'past_due_started_at' => now()->subDays(4),
            'stripe_subscription_id' => 'sub_live_1',
            'ends_at' => now()->addDays(10),
        ]);

        $this->actingAsConsultant($user);

        $this->getJson('/api/v1/consultant/subscription')
            ->assertOk()
            ->assertJsonPath('is_active', false)
            ->assertJsonPath('in_grace', false)
            ->assertJsonPath('subscription.status', 'past_due');
    }

    public function test_active_subscription_still_grants_access(): void
    {
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $this->makeSubscription($user, $package, [
            'status' => 'active',
            'ends_at' => now()->addMonth(),
        ]);

        $this->actingAsConsultant($user);

        $this->getJson('/api/v1/consultant/subscription')
            ->assertOk()
            ->assertJsonPath('is_active', true)
            ->assertJsonPath('in_grace', false);
    }
}
