<?php

namespace Tests\Feature\SubscriptionBilling;

use App\Http\Controllers\StripeWebhookController;
use App\Models\ConsultantSubscription;
use App\Models\ConsultantSubscriptionPlanChange;
use App\Models\StripeWebhookEvent;
use App\Models\SubscriptionPaymentRecord;
use App\Models\UserNotification;
use App\Services\StripePaymentFulfillmentService;
use App\Services\StripeSubscriptionStatusMapper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesSubscriptionFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class SubscriptionBillingHardeningTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesLmsDatabase;
    use CreatesSubscriptionFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wipeLmsTestDatabase();
        $this->seedBillingRoles();
        config(['subscription.grace_days' => 3, 'queue.default' => 'sync']);
    }

    public function test_initial_checkout_activation_creates_one_subscription_and_payment(): void
    {
        $fake = $this->fakeStripe();
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $this->actingAsConsultant($user);

        $checkout = $this->postJson('/api/v1/consultant/payment/stripe/checkout-session', $this->checkoutPayload($package))
            ->assertOk();

        $sessionId = $checkout->json('session_id');
        $this->assertSame(1, $fake->checkoutCreated);

        $this->postJson('/api/v1/consultant/payment/stripe/verify-session', ['session_id' => $sessionId])
            ->assertSuccessful()
            ->assertJsonPath('subscription.status', 'active');

        $this->assertSame(1, ConsultantSubscription::where('user_id', $user->id)->where('status', 'active')->count());
        $this->assertSame(1, SubscriptionPaymentRecord::where('user_id', $user->id)->count());
        $this->assertSame('initial', SubscriptionPaymentRecord::first()->payment_type);
        $this->assertSame(1, UserNotification::where('user_id', $user->id)->where('type', 'subscription_payment_succeeded')->count());
    }

    public function test_verify_session_and_webhook_are_idempotent(): void
    {
        $this->fakeStripe();
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $this->actingAsConsultant($user);

        $sessionId = $this->postJson('/api/v1/consultant/payment/stripe/checkout-session', $this->checkoutPayload($package))->json('session_id');
        $this->postJson('/api/v1/consultant/payment/stripe/verify-session', ['session_id' => $sessionId])->assertSuccessful();

        $session = app(\App\Contracts\StripePlatformClient::class)->retrieveCheckoutSession($sessionId);
        app(StripePaymentFulfillmentService::class)->fulfillPlatformSubscriptionCheckout($session, $user);

        $this->assertSame(1, ConsultantSubscription::where('user_id', $user->id)->count());
        $this->assertSame(1, SubscriptionPaymentRecord::where('user_id', $user->id)->count());
        $this->assertSame(1, UserNotification::where('type', 'subscription_payment_succeeded')->count());
    }

    public function test_duplicate_stripe_event_is_ignored(): void
    {
        $this->fakeStripe();
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $sub = $this->makeSubscription($user, $package, [
            'status' => 'active',
            'stripe_subscription_id' => 'sub_live_dup',
            'stripe_customer_id' => 'cus_dup',
        ]);

        $invoice = (object) [
            'id' => 'in_dup_1',
            'subscription' => 'sub_live_dup',
            'billing_reason' => 'subscription_cycle',
            'subtotal' => 4900,
            'tax' => 0,
            'amount_paid' => 4900,
            'currency' => 'cad',
            'number' => 'INV-2',
            'status_transitions' => (object) ['paid_at' => time()],
        ];
        $stripeSub = (object) [
            'id' => 'sub_live_dup',
            'status' => 'active',
            'current_period_end' => time() + 86400,
            'metadata' => (object) ['type' => 'platform_subscription'],
        ];
        app(\App\Contracts\StripePlatformClient::class)->seedSubscription('sub_live_dup', 'cus_dup');

        $controller = app(StripeWebhookController::class);
        $first = $controller->processVerifiedEvent('evt_dup_1', 'invoice.paid', $invoice);
        $second = $controller->processVerifiedEvent('evt_dup_1', 'invoice.paid', $invoice);

        $this->assertTrue($first['received']);
        $this->assertTrue($second['duplicate'] ?? false);
        $this->assertSame(1, StripeWebhookEvent::where('event_id', 'evt_dup_1')->count());
        $this->assertSame(1, SubscriptionPaymentRecord::where('stripe_invoice_id', 'in_dup_1')->count());
        $this->assertSame('active', $sub->fresh()->status);
    }

    public function test_plan_switch_updates_same_stripe_subscription(): void
    {
        $fake = $this->fakeStripe();
        $user = $this->makeConsultant();
        $starter = $this->makePackage(['name' => 'Starter']);
        $pro = $this->makePackage([
            'name' => 'Pro',
            'monthly_price' => 99,
            'yearly_price' => 990,
            'stripe_monthly_price_id' => 'price_test_pro_monthly',
            'stripe_yearly_price_id' => 'price_test_pro_yearly',
        ]);
        $this->makeSubscription($user, $starter, [
            'status' => 'active',
            'stripe_subscription_id' => 'sub_switch',
            'stripe_customer_id' => 'cus_switch',
            'billing_cycle' => 'monthly',
        ]);
        $fake->seedSubscription('sub_switch', 'cus_switch', 'price_test_monthly');
        $this->actingAsConsultant($user);

        $preview = $this->postJson('/api/v1/consultant/billing/change-plan/preview', [
            'subscription_package_id' => $pro->id,
            'billing_cycle' => 'monthly',
        ])->assertOk()->json('preview');

        $this->assertArrayHasKey('immediate_charge', $preview);
        $this->assertArrayHasKey('credit_amount', $preview);
        $this->assertSame('always_invoice', $preview['proration_behavior']);

        $this->postJson('/api/v1/consultant/billing/change-plan', [
            'subscription_package_id' => $pro->id,
            'billing_cycle' => 'monthly',
            'preview' => $preview,
        ])->assertOk();

        $live = ConsultantSubscription::where('user_id', $user->id)->where('status', 'active')->get();
        $this->assertCount(1, $live);
        $this->assertSame($pro->id, $live->first()->subscription_package_id);
        $this->assertSame('sub_switch', $live->first()->stripe_subscription_id);
        $this->assertSame('price_test_pro_monthly', $fake->subscriptions['sub_switch']->items->data[0]->price->id);
        $this->assertSame(0, $fake->checkoutCreated);
        $this->assertSame(1, ConsultantSubscriptionPlanChange::count());
        $this->assertSame(1, $fake->subscriptionUpdates);
    }

    public function test_existing_stripe_customer_is_reused_on_first_checkout(): void
    {
        $fake = $this->fakeStripe();
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $this->makeSubscription($user, $package, [
            'status' => 'cancelled',
            'stripe_customer_id' => 'cus_reuse',
            'stripe_subscription_id' => 'sub_old_cancelled',
            'ends_at' => now()->subDay(),
        ]);
        $this->actingAsConsultant($user);

        $this->postJson('/api/v1/consultant/payment/stripe/checkout-session', $this->checkoutPayload($package))
            ->assertOk();

        $session = $fake->sessions[array_key_first($fake->sessions)];
        $this->assertSame('cus_reuse', $session->customer);
    }

    public function test_failed_plan_switch_keeps_old_subscription(): void
    {
        $fake = $this->fakeStripe();
        $user = $this->makeConsultant();
        $starter = $this->makePackage();
        $pro = $this->makePackage([
            'name' => 'Pro',
            'monthly_price' => 99,
            'stripe_monthly_price_id' => 'price_test_pro_monthly',
        ]);
        $sub = $this->makeSubscription($user, $starter, [
            'status' => 'active',
            'stripe_subscription_id' => 'sub_keep',
            'stripe_customer_id' => 'cus_keep',
        ]);
        $fake->seedSubscription('sub_keep', 'cus_keep', 'price_test_monthly');
        $fake->failNextUpdate = true;
        $this->actingAsConsultant($user);

        $this->postJson('/api/v1/consultant/billing/change-plan', [
            'subscription_package_id' => $pro->id,
            'billing_cycle' => 'monthly',
        ])->assertStatus(422);

        $fresh = $sub->fresh();
        $this->assertSame($starter->id, $fresh->subscription_package_id);
        $this->assertSame('active', $fresh->status);
        $this->assertSame('price_test_monthly', $fake->subscriptions['sub_keep']->items->data[0]->price->id);
        $this->assertSame('failed', ConsultantSubscriptionPlanChange::first()->result);
    }

    public function test_checkout_refused_when_live_stripe_subscription_exists(): void
    {
        $this->fakeStripe();
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $this->makeSubscription($user, $package, [
            'status' => 'active',
            'stripe_subscription_id' => 'sub_live',
            'stripe_customer_id' => 'cus_live',
        ]);
        $this->actingAsConsultant($user);

        $this->postJson('/api/v1/consultant/payment/stripe/checkout-session', $this->checkoutPayload($package))
            ->assertStatus(409)
            ->assertJsonPath('use_plan_change', true);
    }

    public function test_renewal_success_records_one_payment_and_one_email(): void
    {
        $this->fakeStripe();
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $sub = $this->makeSubscription($user, $package, [
            'stripe_subscription_id' => 'sub_ren',
            'stripe_customer_id' => 'cus_ren',
        ]);
        SubscriptionPaymentRecord::query()->create([
            'user_id' => $user->id,
            'consultant_subscription_id' => $sub->id,
            'subscription_package_id' => $package->id,
            'payment_category' => 'subscription',
            'payment_type' => 'initial',
            'stripe_invoice_id' => 'in_initial',
            'subtotal' => 49,
            'tax_amount' => 0,
            'total' => 49,
            'currency' => 'CAD',
            'paid_at' => now()->subMonth(),
            'payment_status' => 'paid',
        ]);
        app(\App\Contracts\StripePlatformClient::class)->seedSubscription('sub_ren', 'cus_ren');

        $invoice = (object) [
            'id' => 'in_renew_1',
            'subscription' => 'sub_ren',
            'billing_reason' => 'subscription_cycle',
            'subtotal' => 4900,
            'tax' => 0,
            'amount_paid' => 4900,
            'currency' => 'cad',
            'number' => 'INV-R',
            'status_transitions' => (object) ['paid_at' => time()],
        ];

        app(StripeWebhookController::class)->processVerifiedEvent('evt_ren', 'invoice.paid', $invoice);
        app(StripeWebhookController::class)->processVerifiedEvent('evt_ren', 'invoice.paid', $invoice);

        $this->assertSame(1, SubscriptionPaymentRecord::where('stripe_invoice_id', 'in_renew_1')->count());
        $this->assertSame('renewal', SubscriptionPaymentRecord::where('stripe_invoice_id', 'in_renew_1')->value('payment_type'));
        $this->assertSame(1, UserNotification::where('type', 'subscription_renewed')->count());
        $this->assertSame('active', $sub->fresh()->status);
    }

    public function test_initial_invoice_does_not_duplicate_success_notification(): void
    {
        $this->fakeStripe();
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $this->actingAsConsultant($user);
        $sessionId = $this->postJson('/api/v1/consultant/payment/stripe/checkout-session', $this->checkoutPayload($package))->json('session_id');
        $this->postJson('/api/v1/consultant/payment/stripe/verify-session', ['session_id' => $sessionId])->assertStatus(201);

        $session = app(\App\Contracts\StripePlatformClient::class)->retrieveCheckoutSession($sessionId);
        $invoice = $session->invoice;
        $invoice->billing_reason = 'subscription_create';
        $invoice->subscription = $session->subscription->id;

        app(StripeWebhookController::class)->processVerifiedEvent('evt_init_paid', 'invoice.paid', $invoice);

        $this->assertSame(1, SubscriptionPaymentRecord::where('user_id', $user->id)->count());
        $this->assertSame(1, UserNotification::where('type', 'subscription_payment_succeeded')->count());
        $this->assertSame(0, UserNotification::where('type', 'subscription_renewed')->count());
    }

    public function test_renewal_failure_sets_past_due_and_notifies_once(): void
    {
        $this->fakeStripe();
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $sub = $this->makeSubscription($user, $package, [
            'stripe_subscription_id' => 'sub_fail',
            'stripe_customer_id' => 'cus_fail',
        ]);
        app(\App\Contracts\StripePlatformClient::class)->seedSubscription('sub_fail', 'cus_fail', 'price_test_monthly', 'past_due');

        $invoice = (object) ['id' => 'in_fail_1', 'subscription' => 'sub_fail'];
        app(StripeWebhookController::class)->processVerifiedEvent('evt_fail', 'invoice.payment_failed', $invoice);
        app(StripeWebhookController::class)->processVerifiedEvent('evt_fail', 'invoice.payment_failed', $invoice);

        $fresh = $sub->fresh();
        $this->assertSame('past_due', $fresh->status);
        $this->assertNotNull($fresh->past_due_started_at);
        $this->assertTrue($fresh->isCurrentlyActive());
        $this->assertSame(1, UserNotification::where('type', 'subscription_renewal_failed')->count());
        $this->assertStringContainsString('Update payment method', UserNotification::first()->body);
    }

    public function test_grace_expiry_blocks_access_and_recovery_restores_it(): void
    {
        $this->fakeStripe();
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $sub = $this->makeSubscription($user, $package, [
            'status' => 'past_due',
            'past_due_started_at' => now()->subDays(4),
            'stripe_subscription_id' => 'sub_rec',
            'stripe_customer_id' => 'cus_rec',
            'ends_at' => now()->addDays(10),
        ]);
        SubscriptionPaymentRecord::query()->create([
            'user_id' => $user->id,
            'consultant_subscription_id' => $sub->id,
            'subscription_package_id' => $package->id,
            'payment_category' => 'subscription',
            'payment_type' => 'initial',
            'stripe_invoice_id' => 'in_old',
            'subtotal' => 49,
            'tax_amount' => 0,
            'total' => 49,
            'currency' => 'CAD',
            'paid_at' => now()->subMonth(),
            'payment_status' => 'paid',
        ]);
        app(\App\Contracts\StripePlatformClient::class)->seedSubscription('sub_rec', 'cus_rec');
        $this->actingAsConsultant($user);

        $this->getJson('/api/v1/consultant/subscription')->assertOk()->assertJsonPath('is_active', false);

        $invoice = (object) [
            'id' => 'in_recover',
            'subscription' => 'sub_rec',
            'billing_reason' => 'subscription_cycle',
            'subtotal' => 4900,
            'tax' => 0,
            'amount_paid' => 4900,
            'currency' => 'cad',
            'number' => 'INV-REC',
            'status_transitions' => (object) ['paid_at' => time()],
        ];
        app(StripeWebhookController::class)->processVerifiedEvent('evt_rec', 'invoice.paid', $invoice);

        $fresh = $sub->fresh();
        $this->assertSame('active', $fresh->status);
        $this->assertNull($fresh->past_due_started_at);
        $this->assertTrue($fresh->isCurrentlyActive());
        $this->assertSame('recovery', SubscriptionPaymentRecord::where('stripe_invoice_id', 'in_recover')->value('payment_type'));
        $this->assertSame(1, UserNotification::where('type', 'subscription_renewal_recovered')->count());
    }

    public function test_payment_method_portal_uses_platform_customer(): void
    {
        $fake = $this->fakeStripe();
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $this->makeSubscription($user, $package, [
            'stripe_subscription_id' => 'sub_pm',
            'stripe_customer_id' => 'cus_pm',
        ]);
        $this->actingAsConsultant($user);

        $this->postJson('/api/v1/consultant/billing/payment-method-portal')
            ->assertOk()
            ->assertJsonPath('url', 'https://billing.stripe.test/session/bps_test_1');
        $this->assertSame(1, $fake->portalSessions);
    }

    public function test_auto_renew_off_and_reenable_and_period_end_access(): void
    {
        $fake = $this->fakeStripe();
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $sub = $this->makeSubscription($user, $package, [
            'stripe_subscription_id' => 'sub_ar',
            'stripe_customer_id' => 'cus_ar',
            'ends_at' => now()->addDays(12),
        ]);
        $fake->seedSubscription('sub_ar', 'cus_ar');
        $this->actingAsConsultant($user);

        $this->postJson('/api/v1/consultant/billing/auto-renew', ['enabled' => false])
            ->assertOk()
            ->assertJsonPath('auto_renew_enabled', false);
        $this->assertTrue($fake->subscriptions['sub_ar']->cancel_at_period_end);
        $this->assertTrue($sub->fresh()->isCurrentlyActive());
        $this->assertSame(1, UserNotification::where('type', 'subscription_cancellation_scheduled')->count());

        $this->postJson('/api/v1/consultant/billing/auto-renew', ['enabled' => true])
            ->assertOk()
            ->assertJsonPath('auto_renew_enabled', true);
        $this->assertFalse($fake->subscriptions['sub_ar']->cancel_at_period_end);
        $this->assertNull($sub->fresh()->cancelled_at);
    }

    public function test_legacy_subscribe_is_forbidden_for_consultant(): void
    {
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $this->actingAsConsultant($user);

        $this->postJson('/api/v1/consultant/subscription/subscribe', [
            'subscription_package_id' => $package->id,
            'billing_cycle' => 'monthly',
        ])->assertForbidden();

        $this->assertSame(0, ConsultantSubscription::where('user_id', $user->id)->count());
    }

    public function test_admin_can_use_legacy_subscribe_as_manual_grant(): void
    {
        $admin = $this->makeConsultant('admin');
        $package = $this->makePackage();
        $this->actingAsConsultant($admin);

        $this->postJson('/api/v1/consultant/subscription/subscribe', [
            'subscription_package_id' => $package->id,
            'billing_cycle' => 'monthly',
        ])->assertCreated()->assertJsonPath('subscription.status', 'active');
    }

    public function test_status_mapping_is_shared_with_admin_sync_rules(): void
    {
        $mapper = app(StripeSubscriptionStatusMapper::class);
        $this->assertSame('past_due', $mapper->toLocal('past_due'));
        $this->assertSame('active', $mapper->toLocal('trialing'));
        $this->assertSame('cancelled', $mapper->toLocal('canceled'));
    }

    public function test_duplicate_report_lists_multiple_live_stripe_subs_without_cancelling(): void
    {
        $fake = $this->fakeStripe();
        $user = $this->makeConsultant();
        $package = $this->makePackage();
        $this->makeSubscription($user, $package, [
            'stripe_subscription_id' => 'sub_a',
            'stripe_customer_id' => 'cus_dup_user',
            'status' => 'active',
        ]);
        $this->makeSubscription($user, $package, [
            'stripe_subscription_id' => 'sub_b',
            'stripe_customer_id' => 'cus_dup_user',
            'status' => 'cancelled',
            'cancelled_at' => now(),
        ]);
        $fake->seedSubscription('sub_a', 'cus_dup_user');
        $fake->seedSubscription('sub_b', 'cus_dup_user');

        $admin = $this->makeConsultant('admin');
        $this->actingAsConsultant($admin);

        $this->getJson('/api/v1/admin/consultant-subscriptions/stripe-duplicates')
            ->assertOk()
            ->assertJsonPath('auto_cancelled', false)
            ->assertJsonPath('duplicates.0.user_id', $user->id);

        $this->assertSame('active', $fake->subscriptions['sub_a']->status);
        $this->assertSame('active', $fake->subscriptions['sub_b']->status);
    }
}
