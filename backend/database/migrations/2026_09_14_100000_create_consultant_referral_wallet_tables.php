<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        $schema = Schema::connection('cws');

        if (! $schema->hasTable('referral_reward_rules')) {
            $schema->create('referral_reward_rules', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('version')->unique();
                $table->timestamp('effective_from');
                $table->timestamp('effective_to')->nullable();
                $table->boolean('program_enabled')->default(true);
                $table->string('reward_type', 20)->default('fixed');
                $table->decimal('reward_value', 10, 2)->default(50);
                $table->string('currency', 8)->default('CAD');
                $table->json('eligible_package_ids')->nullable();
                $table->string('applies_to', 64)->default('first_paid_subscription_only');
                $table->unsignedSmallInteger('hold_days')->default(14);
                $table->decimal('withdrawal_minimum', 10, 2)->default(50);
                $table->decimal('withdrawal_maximum', 10, 2)->nullable();
                $table->boolean('wallet_credit_enabled')->default(true);
                $table->text('terms_markdown')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('consultant_referral_codes')) {
            $schema->create('consultant_referral_codes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('code', 16)->unique();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->index('user_id');
            });
        }

        if (! $schema->hasTable('consultant_referral_clicks')) {
            $schema->create('consultant_referral_clicks', function (Blueprint $table) {
                $table->id();
                $table->string('code', 16);
                $table->foreignId('referrer_user_id')->constrained('users')->cascadeOnDelete();
                $table->string('ip_hash', 64)->nullable();
                $table->string('user_agent_hash', 64)->nullable();
                $table->timestamps();
                $table->index(['code', 'created_at']);
            });
        }

        if (! $schema->hasTable('consultant_referrals')) {
            $schema->create('consultant_referrals', function (Blueprint $table) {
                $table->id();
                $table->foreignId('referrer_user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('referred_user_id')->unique()->constrained('users')->cascadeOnDelete();
                $table->foreignId('referral_code_id')->nullable()->constrained('consultant_referral_codes')->nullOnDelete();
                $table->string('status', 32)->default('registered');
                $table->timestamp('qualified_at')->nullable();
                $table->foreignId('qualifying_subscription_id')->nullable()->constrained('consultant_subscriptions')->nullOnDelete();
                $table->foreignId('qualifying_payment_record_id')->nullable()->unique()->constrained('subscription_payment_records')->nullOnDelete();
                $table->string('qualifying_stripe_invoice_id')->nullable()->unique();
                $table->timestamp('reward_created_at')->nullable();
                $table->timestamp('attribution_locked_at')->nullable();
                $table->timestamps();
                $table->index(['referrer_user_id', 'status']);
            });
        }

        if (! $schema->hasTable('referral_rewards')) {
            $schema->create('referral_rewards', function (Blueprint $table) {
                $table->id();
                $table->foreignId('referral_id')->unique()->constrained('consultant_referrals')->cascadeOnDelete();
                $table->foreignId('referred_user_id')->unique()->constrained('users')->cascadeOnDelete();
                $table->foreignId('referrer_user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('reward_rule_id')->nullable()->constrained('referral_reward_rules')->nullOnDelete();
                $table->unsignedInteger('reward_rule_version');
                $table->decimal('reward_amount_snapshot', 10, 2);
                $table->unsignedSmallInteger('hold_days_snapshot');
                $table->string('currency', 8)->default('CAD');
                $table->string('status', 32)->default('pending');
                $table->timestamp('reward_available_at')->nullable();
                $table->timestamp('available_at')->nullable();
                $table->timestamp('reversed_at')->nullable();
                $table->foreignId('qualifying_payment_record_id')->nullable()->unique()->constrained('subscription_payment_records')->nullOnDelete();
                $table->string('qualifying_stripe_invoice_id')->nullable()->unique();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('consultant_wallets')) {
            $schema->create('consultant_wallets', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
                $table->string('currency', 8)->default('CAD');
                $table->decimal('pending_rewards', 12, 2)->default(0);
                $table->decimal('available_balance', 12, 2)->default(0);
                $table->decimal('reserved_for_withdrawal', 12, 2)->default(0);
                $table->decimal('spendable_balance', 12, 2)->default(0);
                $table->decimal('lifetime_earned', 12, 2)->default(0);
                $table->decimal('lifetime_subscription_credits', 12, 2)->default(0);
                $table->decimal('lifetime_withdrawn', 12, 2)->default(0);
                $table->boolean('auto_use_wallet_on_renewal')->default(false);
                $table->timestamp('withdrawals_frozen_at')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('consultant_wallet_transactions')) {
            $schema->create('consultant_wallet_transactions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('wallet_id')->constrained('consultant_wallets')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('type', 48);
                $table->string('direction', 8);
                $table->decimal('amount', 12, 2);
                $table->string('currency', 8)->default('CAD');
                $table->string('status', 20)->default('posted');
                $table->string('reference_type', 80)->nullable();
                $table->unsignedBigInteger('reference_id')->nullable();
                $table->string('idempotency_key', 128)->unique();
                $table->string('description')->nullable();
                $table->json('metadata')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->index(['wallet_id', 'created_at']);
                $table->index(['reference_type', 'reference_id']);
            });
        }

        if (! $schema->hasTable('consultant_withdrawal_requests')) {
            $schema->create('consultant_withdrawal_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('wallet_id')->constrained('consultant_wallets')->cascadeOnDelete();
                $table->decimal('amount', 12, 2);
                $table->string('currency', 8)->default('CAD');
                $table->string('status', 32)->default('requested');
                $table->string('account_holder_name');
                $table->string('bank_name');
                $table->text('account_number_encrypted');
                $table->text('transit_number_encrypted')->nullable();
                $table->string('institution_number', 20)->nullable();
                $table->string('routing_swift')->nullable();
                $table->string('country', 2)->default('CA');
                $table->string('account_last4', 4)->nullable();
                $table->text('consultant_note')->nullable();
                $table->text('admin_notes')->nullable();
                $table->string('payout_reference')->nullable();
                $table->timestamp('requested_at');
                $table->timestamp('reviewed_at')->nullable();
                $table->timestamp('paid_at')->nullable();
                $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('reserved_transaction_id')->nullable()->constrained('consultant_wallet_transactions')->nullOnDelete();
                $table->foreignId('paid_transaction_id')->nullable()->constrained('consultant_wallet_transactions')->nullOnDelete();
                $table->timestamps();
                $table->index(['status', 'requested_at']);
            });
        }

        if (! $schema->hasTable('referral_audit_events')) {
            $schema->create('referral_audit_events', function (Blueprint $table) {
                $table->id();
                $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('action', 80);
                $table->string('subject_type', 80);
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->json('before')->nullable();
                $table->json('after')->nullable();
                $table->string('ip', 45)->nullable();
                $table->timestamps();
                $table->index(['subject_type', 'subject_id']);
            });
        }

        if (! $schema->hasTable('referral_risk_flags')) {
            $schema->create('referral_risk_flags', function (Blueprint $table) {
                $table->id();
                $table->foreignId('referral_id')->nullable()->constrained('consultant_referrals')->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
                $table->string('code', 64);
                $table->string('severity', 16)->default('review');
                $table->string('status', 16)->default('open');
                $table->json('details')->nullable();
                $table->timestamp('cleared_at')->nullable();
                $table->timestamps();
                $table->index(['status', 'code']);
            });
        }
    }

    public function down(): void
    {
        $schema = Schema::connection('cws');
        $schema->dropIfExists('referral_risk_flags');
        $schema->dropIfExists('referral_audit_events');
        $schema->dropIfExists('consultant_withdrawal_requests');
        $schema->dropIfExists('consultant_wallet_transactions');
        $schema->dropIfExists('consultant_wallets');
        $schema->dropIfExists('referral_rewards');
        $schema->dropIfExists('consultant_referrals');
        $schema->dropIfExists('consultant_referral_clicks');
        $schema->dropIfExists('consultant_referral_codes');
        $schema->dropIfExists('referral_reward_rules');
    }
};
