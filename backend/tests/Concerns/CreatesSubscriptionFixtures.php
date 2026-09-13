<?php

namespace Tests\Concerns;

use App\Contracts\StripePlatformClient;
use App\Models\ConsultantSubscription;
use App\Models\PaymentGatewaySetting;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Laravel\Sanctum\Sanctum;
use Tests\Fakes\FakeStripePlatformClient;

trait CreatesSubscriptionFixtures
{
    protected function seedBillingRoles(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    protected function makeConsultant(string $role = 'rcic'): User
    {
        $user = User::factory()->create([
            'is_license_verified' => true,
            'email_verified_at'   => now(),
        ]);
        $user->assignRole($role);

        return $user;
    }

    protected function makePackage(array $overrides = []): SubscriptionPackage
    {
        return SubscriptionPackage::query()->create(array_merge([
            'name'              => 'Starter',
            'description'       => 'Starter plan',
            'monthly_price'     => 49.00,
            'yearly_price'      => 490.00,
            'free_trial_days'   => 14,
            'features'          => ['Workspace'],
            'is_active'         => true,
            'sort_order'        => 1,
            'stripe_product_id' => 'prod_test_starter',
            'stripe_monthly_price_id' => 'price_test_monthly',
            'stripe_yearly_price_id'  => 'price_test_yearly',
        ], $overrides));
    }

    protected function makeSubscription(User $user, SubscriptionPackage $package, array $overrides = []): ConsultantSubscription
    {
        return ConsultantSubscription::query()->create(array_merge([
            'user_id'                 => $user->id,
            'subscription_package_id' => $package->id,
            'status'                  => 'active',
            'is_trial'                => false,
            'starts_at'               => now()->subDay(),
            'ends_at'                 => now()->addMonth(),
            'billing_cycle'           => 'monthly',
            'last_payment_at'         => now()->subDay(),
        ], $overrides));
    }

    protected function actingAsConsultant(User $user): void
    {
        Sanctum::actingAs($user);
    }

    protected function fakeStripe(): FakeStripePlatformClient
    {
        $fake = new FakeStripePlatformClient();
        $this->app->instance(StripePlatformClient::class, $fake);
        $this->seedStripeGateway();

        return $fake;
    }

    protected function seedStripeGateway(): void
    {
        PaymentGatewaySetting::query()->updateOrCreate(
            ['gateway' => 'stripe'],
            [
                'mode'            => 'test',
                'is_active'       => true,
                'publishable_key' => PaymentGatewaySetting::encryptKey('pk_test_billing_hardening'),
                'secret_key'      => PaymentGatewaySetting::encryptKey('sk_test_billing_hardening'),
                'webhook_id'      => PaymentGatewaySetting::encryptKey('whsec_billing_hardening'),
            ]
        );
    }

    /** @return array<string, mixed> */
    protected function checkoutPayload(SubscriptionPackage $package, string $cycle = 'monthly'): array
    {
        return [
            'subscription_package_id' => $package->id,
            'billing_cycle'           => $cycle,
            'billing_country'         => 'CA',
            'billing_address_line1'   => '100 Queen Street',
            'billing_city'            => 'Toronto',
            'billing_province'        => 'ON',
            'billing_postal_code'     => 'M5H 2N2',
            'province'                => 'ON',
        ];
    }
}
