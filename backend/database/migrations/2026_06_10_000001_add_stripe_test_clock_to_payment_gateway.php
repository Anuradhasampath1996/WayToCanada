<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_gateway_settings', function (Blueprint $table) {
            $table->string('stripe_test_clock_id', 64)->nullable()->after('webhook_id');
            $table->boolean('use_test_clock')->default(false)->after('stripe_test_clock_id');
        });
    }

    public function down(): void
    {
        Schema::table('payment_gateway_settings', function (Blueprint $table) {
            $table->dropColumn(['stripe_test_clock_id', 'use_test_clock']);
        });
    }
};
