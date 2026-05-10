<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            $table->string('paypal_product_id')->nullable()->after('sort_order');
            $table->string('paypal_monthly_plan_id')->nullable()->after('paypal_product_id');
            $table->string('paypal_yearly_plan_id')->nullable()->after('paypal_monthly_plan_id');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            $table->dropColumn(['paypal_product_id', 'paypal_monthly_plan_id', 'paypal_yearly_plan_id']);
        });
    }
};
