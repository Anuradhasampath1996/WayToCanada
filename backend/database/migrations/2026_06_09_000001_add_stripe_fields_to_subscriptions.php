<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            $table->string('stripe_product_id', 64)->nullable()->after('paypal_yearly_plan_id');
            $table->string('stripe_monthly_price_id', 64)->nullable()->after('stripe_product_id');
            $table->string('stripe_yearly_price_id', 64)->nullable()->after('stripe_monthly_price_id');
        });

        Schema::table('consultant_subscriptions', function (Blueprint $table) {
            $table->string('stripe_customer_id', 64)->nullable()->after('paypal_subscription_id');
            $table->string('stripe_subscription_id', 64)->nullable()->after('stripe_customer_id');
            $table->string('stripe_checkout_session_id', 128)->nullable()->after('stripe_subscription_id');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            $table->dropColumn(['stripe_product_id', 'stripe_monthly_price_id', 'stripe_yearly_price_id']);
        });

        Schema::table('consultant_subscriptions', function (Blueprint $table) {
            $table->dropColumn(['stripe_customer_id', 'stripe_subscription_id', 'stripe_checkout_session_id']);
        });
    }
};
