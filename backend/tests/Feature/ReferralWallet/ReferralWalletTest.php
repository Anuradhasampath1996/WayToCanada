<?php

namespace Tests\Feature\ReferralWallet;

use App\Http\Controllers\StripeWebhookController;
use App\Models\ConsultantReferral;
use App\Models\ConsultantReferralClick;
use App\Models\ConsultantWalletTransaction;
use App\Models\ConsultantWithdrawalRequest;
use App\Models\ReferralAuditEvent;
use App\Models\ReferralReward;
use App\Models\ReferralRiskFlag;
use App\Models\SubscriptionPaymentRecord;
use App\Models\User;
use App\Services\Referral\ConsultantWalletLedgerService;
use App\Services\Referral\ReferralAttributionService;
use App\Services\Referral\ReferralCodeService;
use App\Services\Referral\ReferralHoldReleaseService;
use App\Services\Referral\ReferralLifecycleService;
use App\Services\Referral\ReferralQualificationService;
use App\Services\Referral\ReferralReversalService;
use App\Services\Referral\ReferralSettingsService;
use App\Services\Referral\WalletSubscriptionCreditService;
use App\Services\Referral\WithdrawalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesSubscriptionFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class ReferralWalletTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesLmsDatabase;
    use CreatesSubscriptionFixtures;

    private ReferralSettingsService $settings;

    private ReferralCodeService $codes;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wipeLmsTestDatabase();
        $this->seedBillingRoles();
        config(['queue.default' => 'sync']);
        $this->settings = app(ReferralSettingsService::class);
        $this->settings->ensureDefault();
        $this->codes = app(ReferralCodeService::class);
    }

    public function test_unique_referral_link_is_generated(): void
    {
        $user = $this->makeConsultant();
        $first = $this->codes->ensureForUser($user);
        $second = $this->codes->ensureForUser($user);

        $this->assertSame($first->id, $second->id);
        $this->assertMatchesRegularExpression('/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8,12}$/', $first->code);
        $this->assertStringContainsString('/ref/'.$first->code, $first->publicUrl());
    }

    public function test_click_is_stored_and_registration_creates_referral(): void
    {
        $referrer = $this->makeConsultant();
        $code = $this->codes->ensureForUser($referrer);

        $this->postJson('/api/v1/referral/attribute/'.$code->code)->assertOk();
        $this->assertSame(1, ConsultantReferralClick::query()->where('code', $code->code)->count());

        $referred = User::factory()->create(['email_verified_at' => now()]);
        $referred->assignRole('rcic');
        app(ReferralAttributionService::class)->attachFromCode($referred, $code->code);

        $referral = ConsultantReferral::query()->where('referred_user_id', $referred->id)->first();
        $this->assertNotNull($referral);
        $this->assertSame($referrer->id, $referral->referrer_user_id);
        $this->assertSame(ConsultantReferral::STATUS_REGISTERED, $referral->status);
        $this->assertSame(0, ReferralReward::count());
    }

    public function test_existing_referrer_cannot_be_overwritten(): void
    {
        [$referrer, $referred, $referral] = $this->seedRegisteredReferral();
        $other = $this->makeConsultant();
        $otherCode = $this->codes->ensureForUser($other);

        app(ReferralAttributionService::class)->attachFromCode($referred, $otherCode->code);

        $this->assertSame($referrer->id, $referral->fresh()->referrer_user_id);
        $this->assertSame(1, ConsultantReferral::query()->where('referred_user_id', $referred->id)->count());
    }

    public function test_self_referral_is_blocked(): void
    {
        $user = $this->makeConsultant();
        $code = $this->codes->ensureForUser($user);

        $attached = app(ReferralAttributionService::class)->attachFromCode($user, $code->code);

        $this->assertNull($attached);
        $this->assertSame(0, ConsultantReferral::count());
    }

    public function test_rcic_verification_updates_state_without_reward(): void
    {
        [, $referred] = $this->seedRegisteredReferral();
        $referred->update(['is_license_verified' => true, 'license_verified_at' => now(), 'rcic_number' => 'R12345']);

        app(ReferralLifecycleService::class)->onLicenseVerified($referred->fresh());

        $this->assertSame(ConsultantReferral::STATUS_RCIC_VERIFIED, ConsultantReferral::first()->status);
        $this->assertSame(0, ReferralReward::count());
    }

    public function test_trial_does_not_qualify(): void
    {
        [, $referred] = $this->seedRegisteredReferral();
        app(ReferralLifecycleService::class)->onTrialStarted($referred);

        $this->assertSame(ConsultantReferral::STATUS_TRIAL_STARTED, ConsultantReferral::first()->status);
        $this->assertSame(0, ReferralReward::count());
    }

    public function test_first_eligible_paid_subscription_qualifies_pending_reward(): void
    {
        [$referrer, $referred] = $this->seedVerifiedReferral();
        $payment = $this->paidInitial($referred);

        $reward = app(ReferralQualificationService::class)->onPlatformPaymentRecorded($payment);

        $this->assertNotNull($reward);
        $this->assertSame(ReferralReward::STATUS_PENDING, $reward->status);
        $this->assertSame(50.0, (float) $reward->reward_amount_snapshot);
        $this->assertTrue($reward->reward_available_at->greaterThan(now()->addDays(13)));
        $wallet = app(ConsultantWalletLedgerService::class)->forUser($referrer);
        $this->assertSame(50.0, (float) $wallet->fresh()->pending_rewards);
        $this->assertSame(0.0, (float) $wallet->fresh()->spendable_balance);
        $this->assertSame(ConsultantReferral::STATUS_SUBSCRIBED, ConsultantReferral::first()->status);
    }

    public function test_failed_zero_renewal_recovery_marketing_storage_and_complimentary_do_not_qualify(): void
    {
        [, $referred] = $this->seedVerifiedReferral();

        $failed = $this->paidInitial($referred, ['payment_status' => SubscriptionPaymentRecord::STATUS_FAILED, 'stripe_invoice_id' => 'in_fail']);
        $this->assertNull(app(ReferralQualificationService::class)->onPlatformPaymentRecorded($failed));

        $zero = $this->paidInitial($referred, ['total' => 0, 'stripe_invoice_id' => 'in_zero']);
        $this->assertNull(app(ReferralQualificationService::class)->onPlatformPaymentRecorded($zero));

        $renewal = $this->paidInitial($referred, ['payment_type' => SubscriptionPaymentRecord::TYPE_RENEWAL, 'stripe_invoice_id' => 'in_ren']);
        $this->assertNull(app(ReferralQualificationService::class)->onPlatformPaymentRecorded($renewal));

        $recovery = $this->paidInitial($referred, ['payment_type' => SubscriptionPaymentRecord::TYPE_RECOVERY, 'stripe_invoice_id' => 'in_rec']);
        $this->assertNull(app(ReferralQualificationService::class)->onPlatformPaymentRecorded($recovery));

        $marketing = $this->paidInitial($referred, [
            'payment_category' => SubscriptionPaymentRecord::CATEGORY_MARKETING,
            'stripe_invoice_id' => 'in_mkt',
        ]);
        $this->assertNull(app(ReferralQualificationService::class)->onPlatformPaymentRecorded($marketing));

        $storage = $this->paidInitial($referred, [
            'payment_category' => SubscriptionPaymentRecord::CATEGORY_STORAGE,
            'stripe_invoice_id' => 'in_sto',
        ]);
        $this->assertNull(app(ReferralQualificationService::class)->onPlatformPaymentRecorded($storage));

        $this->assertSame(0, ReferralReward::count());
    }

    public function test_duplicate_qualification_and_one_reward_lifetime(): void
    {
        [, $referred] = $this->seedVerifiedReferral();
        $first = $this->paidInitial($referred, ['stripe_invoice_id' => 'in_one']);
        $second = $this->paidInitial($referred, ['stripe_invoice_id' => 'in_two']);

        app(ReferralQualificationService::class)->onPlatformPaymentRecorded($first);
        app(ReferralQualificationService::class)->onPlatformPaymentRecorded($first);
        app(ReferralQualificationService::class)->onPlatformPaymentRecorded($second);

        $this->assertSame(1, ReferralReward::count());
    }

    public function test_hold_release_makes_reward_available(): void
    {
        [$referrer, $referred] = $this->seedVerifiedReferral();
        $payment = $this->paidInitial($referred);
        $reward = app(ReferralQualificationService::class)->onPlatformPaymentRecorded($payment);
        $reward->update(['reward_available_at' => now()->subMinute()]);

        $this->assertSame(1, app(ReferralHoldReleaseService::class)->releaseDue());
        $this->assertSame(ReferralReward::STATUS_AVAILABLE, $reward->fresh()->status);

        $wallet = app(ConsultantWalletLedgerService::class)->recompute(
            app(ConsultantWalletLedgerService::class)->forUser($referrer)
        );
        $this->assertSame(50.0, (float) $wallet->available_balance);
        $this->assertSame(50.0, (float) $wallet->spendable_balance);
        $this->assertSame(50.0, (float) $wallet->lifetime_earned);
        $this->assertSame(0.0, (float) $wallet->pending_rewards);
    }

    public function test_refund_during_hold_cancels_and_after_available_reverses(): void
    {
        [, $referred] = $this->seedVerifiedReferral();
        $payment = $this->paidInitial($referred);
        $reward = app(ReferralQualificationService::class)->onPlatformPaymentRecorded($payment);

        app(ReferralReversalService::class)->reverseFromPayment($payment, 'refunded');
        $this->assertSame(ReferralReward::STATUS_CANCELLED, $reward->fresh()->status);
        $this->assertSame(1, ReferralReward::count());

        $again = $this->paidInitial($referred, ['stripe_invoice_id' => 'in_second_try']);
        $existing = app(ReferralQualificationService::class)->onPlatformPaymentRecorded($again);
        $this->assertSame($reward->id, $existing?->id);
        $this->assertSame(ReferralReward::STATUS_CANCELLED, $existing->status);
        $this->assertSame(1, ReferralReward::count());
    }

    public function test_refund_after_available_reverses_spendable(): void
    {
        [$referrer, $referred] = $this->seedVerifiedReferral();
        $payment = $this->paidInitial($referred);
        $reward = app(ReferralQualificationService::class)->onPlatformPaymentRecorded($payment);
        $reward->update(['reward_available_at' => now()->subMinute()]);
        app(ReferralHoldReleaseService::class)->release($reward->fresh());

        app(ReferralReversalService::class)->reverseFromPayment($payment, 'refunded');

        $wallet = app(ConsultantWalletLedgerService::class)->recompute(
            app(ConsultantWalletLedgerService::class)->forUser($referrer)
        );
        $this->assertSame(ReferralReward::STATUS_REVERSED, $reward->fresh()->status);
        $this->assertSame(0.0, (float) $wallet->spendable_balance);
        $this->assertSame(3, ConsultantWalletTransaction::count());
    }

    public function test_withdrawals_reserve_double_spend_min_and_admin_flow(): void
    {
        $referrer = $this->availableWalletUser(80);
        Sanctum::actingAs($referrer);

        $this->postJson('/api/v1/consultant/withdrawals', $this->withdrawalPayload(40))
            ->assertUnprocessable();

        $this->postJson('/api/v1/consultant/withdrawals', $this->withdrawalPayload(90))
            ->assertUnprocessable();

        $created = $this->postJson('/api/v1/consultant/withdrawals', $this->withdrawalPayload(50))
            ->assertCreated()
            ->json('withdrawal');

        $wallet = app(ConsultantWalletLedgerService::class)->forUser($referrer)->fresh();
        $this->assertSame(50.0, (float) $wallet->reserved_for_withdrawal);
        $this->assertSame(30.0, (float) $wallet->spendable_balance);

        $this->postJson('/api/v1/consultant/withdrawals', $this->withdrawalPayload(50))
            ->assertUnprocessable();

        $request = ConsultantWithdrawalRequest::find($created['id']);
        $admin = $this->makeConsultant('admin');

        app(WithdrawalService::class)->reject($request, $admin->id, 'docs');
        $wallet = app(ConsultantWalletLedgerService::class)->recompute($wallet->fresh());
        $this->assertSame(80.0, (float) $wallet->spendable_balance);

        $second = app(WithdrawalService::class)->request($referrer, $this->withdrawalPayload(50));
        app(WithdrawalService::class)->approve($second, $admin->id);
        app(WithdrawalService::class)->markPaid($second, $admin->id, 'EFT-1');
        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);
        app(WithdrawalService::class)->markPaid($second->fresh(), $admin->id, 'EFT-2');
    }

    public function test_consultant_cannot_view_another_wallet_and_admin_can_manage(): void
    {
        $a = $this->availableWalletUser(50);
        $b = $this->makeConsultant();
        Sanctum::actingAs($b);

        $this->getJson('/api/v1/consultant/referral')
            ->assertOk()
            ->assertJsonPath('stats.available_balance', 0);

        $admin = $this->makeConsultant('admin');
        Sanctum::actingAs($admin);
        $this->getJson('/api/v1/admin/referral-program/ledger')->assertOk();
        $this->putJson('/api/v1/admin/referral-program/settings', [
            'program_enabled' => true,
            'reward_value' => 75,
            'hold_days' => 10,
            'withdrawal_minimum' => 50,
            'wallet_credit_enabled' => true,
            'terms_markdown' => 'Draft terms',
        ])->assertOk()->assertJsonPath('settings.reward_value', 75);
        $this->assertSame(2, $this->settings->current()->version);

        $this->postJson('/api/v1/admin/referral-program/wallets/'.$a->id.'/adjust', [
            'direction' => 'credit',
            'amount' => 5,
            'reason' => 'Manual correction',
        ])->assertOk();

        $this->assertGreaterThan(0, ReferralAuditEvent::query()->where('action', 'wallet_adjusted')->count());
    }

    public function test_program_disabled_blocks_new_attribution_and_qualification(): void
    {
        $referrer = $this->makeConsultant();
        $code = $this->codes->ensureForUser($referrer);
        $this->settings->publish(['program_enabled' => false], $referrer->id);

        $this->postJson('/api/v1/referral/attribute/'.$code->code)->assertOk();
        $this->assertSame(1, ConsultantReferralClick::count());

        $off = User::factory()->create(['email_verified_at' => now()]);
        $off->assignRole('rcic');
        $this->assertNull(app(ReferralAttributionService::class)->attachFromCode($off, $code->code));
        $this->assertSame(0, ConsultantReferral::count());

        $this->settings->publish(['program_enabled' => true], $referrer->id);
        [$onReferrer, $referred] = $this->seedVerifiedReferral();
        $this->settings->publish(['program_enabled' => false], $onReferrer->id);
        $payment = $this->paidInitial($referred);
        $this->assertNull(app(ReferralQualificationService::class)->onPlatformPaymentRecorded($payment));
    }

    public function test_historical_ledger_is_never_deleted_and_rule_snapshot_is_kept(): void
    {
        [, $referred] = $this->seedVerifiedReferral();
        $payment = $this->paidInitial($referred);
        $reward = app(ReferralQualificationService::class)->onPlatformPaymentRecorded($payment);
        $this->assertSame(50.0, (float) $reward->reward_amount_snapshot);
        $this->settings->publish(['reward_value' => 25], $referred->id);
        $this->assertSame(50.0, (float) $reward->fresh()->reward_amount_snapshot);
        $this->assertSame(1, ConsultantWalletTransaction::count());
        $this->assertSame(1, ConsultantWalletTransaction::query()->where('idempotency_key', 'reward_pending:'.$reward->id)->count());
    }

    public function test_wallet_credit_is_invoice_specific_idempotent_and_renewal_only(): void
    {
        $this->fakeStripe();
        $user = $this->availableWalletUser(40);
        $package = $this->makePackage();
        $sub = $this->makeSubscription($user, $package, [
            'stripe_subscription_id' => 'sub_credit_1',
            'stripe_customer_id' => 'cus_credit_1',
        ]);
        app(\App\Contracts\StripePlatformClient::class)->seedSubscription('sub_credit_1', 'cus_credit_1');
        $wallet = app(ConsultantWalletLedgerService::class)->forUser($user);
        $wallet->update(['auto_use_wallet_on_renewal' => true]);

        $invoice = (object) [
            'id' => 'in_credit_1',
            'customer' => 'cus_credit_1',
            'subscription' => 'sub_credit_1',
            'status' => 'draft',
            'billing_reason' => 'subscription_cycle',
            'amount_due' => 4900,
        ];

        $service = app(WalletSubscriptionCreditService::class);
        $service->onInvoiceCreated($invoice);
        $service->onInvoiceCreated($invoice);
        $this->assertSame(1, ConsultantWalletTransaction::query()->where('type', ConsultantWalletTransaction::TYPE_SUB_CREDIT_RESERVED)->count());
        $this->assertSame(1, count(app(\App\Contracts\StripePlatformClient::class)->invoiceItems));

        $payment = $this->paidInitial($user, [
            'payment_type' => SubscriptionPaymentRecord::TYPE_RENEWAL,
            'consultant_subscription_id' => $sub->id,
            'stripe_invoice_id' => 'in_credit_1',
        ]);
        $service->finalizeFromPayment($payment, $invoice);
        $service->finalizeFromPayment($payment, $invoice);
        $this->assertSame(1, ConsultantWalletTransaction::query()->where('type', ConsultantWalletTransaction::TYPE_SUB_CREDIT_APPLIED)->count());
        $this->assertSame(40.0, (float) $payment->fresh()->wallet_credit_amount);

        $checkoutInvoice = (object) [
            'id' => 'in_first_checkout',
            'customer' => 'cus_credit_1',
            'subscription' => 'sub_credit_1',
            'status' => 'draft',
            'billing_reason' => 'subscription_create',
            'amount_due' => 4900,
        ];
        $before = ConsultantWalletTransaction::count();
        $service->onInvoiceCreated($checkoutInvoice);
        $this->assertSame($before, ConsultantWalletTransaction::count());
    }

    public function test_voided_invoice_releases_wallet_credit(): void
    {
        $this->fakeStripe();
        $user = $this->availableWalletUser(40);
        $package = $this->makePackage();
        $this->makeSubscription($user, $package, [
            'stripe_subscription_id' => 'sub_void_1',
            'stripe_customer_id' => 'cus_void_1',
        ]);
        app(\App\Contracts\StripePlatformClient::class)->seedSubscription('sub_void_1', 'cus_void_1');
        app(ConsultantWalletLedgerService::class)->forUser($user)->update(['auto_use_wallet_on_renewal' => true]);

        $invoice = (object) [
            'id' => 'in_void_1',
            'customer' => 'cus_void_1',
            'subscription' => 'sub_void_1',
            'status' => 'draft',
            'billing_reason' => 'subscription_cycle',
            'amount_due' => 2000,
        ];
        $service = app(WalletSubscriptionCreditService::class);
        $service->onInvoiceCreated($invoice);
        $service->onInvoiceVoided($invoice);

        $wallet = app(ConsultantWalletLedgerService::class)->recompute(
            app(ConsultantWalletLedgerService::class)->forUser($user)
        );
        $this->assertSame(40.0, (float) $wallet->spendable_balance);
    }

    public function test_charge_refunded_resolves_via_invoice_not_payment_intent(): void
    {
        [, $referred] = $this->seedVerifiedReferral();
        $payment = $this->paidInitial($referred, ['stripe_invoice_id' => 'in_real_1']);
        app(ReferralQualificationService::class)->onPlatformPaymentRecorded($payment);

        $fake = $this->fakeStripe();
        $fake->paymentIntentInvoices['pi_wrong'] = 'in_real_1';

        app(StripeWebhookController::class)->processVerifiedEvent('evt_ref_1', 'charge.refunded', (object) [
            'id' => 'ch_1',
            'payment_intent' => 'pi_wrong',
            'invoice' => 'in_real_1',
            'metadata' => (object) [],
        ]);

        $this->assertSame(SubscriptionPaymentRecord::STATUS_REFUNDED, $payment->fresh()->payment_status);
        $this->assertSame(ReferralReward::STATUS_CANCELLED, ReferralReward::first()->status);
    }

    public function test_consultant_can_cancel_withdrawal_only_before_approval(): void
    {
        $referrer = $this->availableWalletUser(80);
        Sanctum::actingAs($referrer);
        $id = $this->postJson('/api/v1/consultant/withdrawals', $this->withdrawalPayload(50))->json('withdrawal.id');
        $this->postJson("/api/v1/consultant/withdrawals/{$id}/cancel")->assertOk();

        $again = app(WithdrawalService::class)->request($referrer, $this->withdrawalPayload(50));
        app(WithdrawalService::class)->approve($again, $this->makeConsultant('admin')->id);
        Sanctum::actingAs($referrer);
        $this->postJson("/api/v1/consultant/withdrawals/{$again->id}/cancel")->assertUnprocessable();
    }

    public function test_same_rcic_as_referrer_is_blocked_and_shared_ip_is_review_only(): void
    {
        $referrer = $this->makeConsultant();
        $referrer->update(['rcic_number' => 'R99999']);
        $code = $this->codes->ensureForUser($referrer);
        $referred = $this->makeConsultant();
        $referred->update(['rcic_number' => 'R99999']);

        $this->assertNull(app(ReferralAttributionService::class)->attachFromCode($referred, $code->code));
        $this->assertTrue(ReferralRiskFlag::query()->where('code', 'same_rcic_number')->exists());
    }

    /** @return array{0: User, 1: User, 2: ConsultantReferral} */
    private function seedRegisteredReferral(): array
    {
        $referrer = $this->makeConsultant();
        $code = $this->codes->ensureForUser($referrer);
        $referred = User::factory()->create(['email_verified_at' => now()]);
        $referred->assignRole('rcic');
        $referral = app(ReferralAttributionService::class)->attachFromCode($referred, $code->code);

        return [$referrer, $referred, $referral];
    }

    /** @return array{0: User, 1: User, 2: ConsultantReferral} */
    private function seedVerifiedReferral(): array
    {
        [$referrer, $referred, $referral] = $this->seedRegisteredReferral();
        $referred->update(['is_license_verified' => true, 'license_verified_at' => now(), 'rcic_number' => 'R54321']);
        app(ReferralLifecycleService::class)->onLicenseVerified($referred->fresh());

        return [$referrer, $referred->fresh(), $referral->fresh()];
    }

    private function paidInitial(User $user, array $overrides = []): SubscriptionPaymentRecord
    {
        $package = $this->makePackage();
        $sub = $this->makeSubscription($user, $package);

        return SubscriptionPaymentRecord::query()->create(array_merge([
            'user_id' => $user->id,
            'payment_category' => SubscriptionPaymentRecord::CATEGORY_SUBSCRIPTION,
            'consultant_subscription_id' => $sub->id,
            'subscription_package_id' => $package->id,
            'payment_type' => SubscriptionPaymentRecord::TYPE_INITIAL,
            'billing_cycle' => 'monthly',
            'stripe_invoice_id' => 'in_'.uniqid(),
            'currency' => 'CAD',
            'subtotal' => 49,
            'tax_amount' => 0,
            'total' => 49,
            'payment_status' => SubscriptionPaymentRecord::STATUS_PAID,
            'paid_at' => now(),
        ], $overrides));
    }

    private function availableWalletUser(float $amount): User
    {
        [$referrer, $referred] = $this->seedVerifiedReferral();
        $payment = $this->paidInitial($referred);
        $reward = app(ReferralQualificationService::class)->onPlatformPaymentRecorded($payment);
        $reward->update(['reward_available_at' => now()->subMinute(), 'reward_amount_snapshot' => $amount]);
        ConsultantWalletTransaction::query()->where('idempotency_key', 'reward_pending:'.$reward->id)
            ->update(['amount' => $amount]);
        app(ReferralHoldReleaseService::class)->release($reward->fresh());

        return $referrer->fresh();
    }

    /** @return array<string, mixed> */
    private function registerPayload(string $email, string $code): array
    {
        return [
            'first_name' => 'Pat',
            'last_name' => 'Lee',
            'email' => $email,
            'phone' => '4165550101',
            'password' => 'Password1',
            'password_confirmation' => 'Password1',
            'referral_code' => $code,
        ];
    }

    /** @return array<string, mixed> */
    private function withdrawalPayload(float $amount): array
    {
        return [
            'amount' => $amount,
            'account_holder_name' => 'Pat Lee',
            'bank_name' => 'RBC',
            'account_number' => '123456789012',
            'transit_number' => '12345',
            'institution_number' => '003',
            'country' => 'CA',
        ];
    }
}
