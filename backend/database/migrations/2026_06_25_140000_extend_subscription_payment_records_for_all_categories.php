<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_payment_records', function (Blueprint $table) {
            $table->string('payment_category', 20)->default('subscription')->after('user_id');
            $table->unsignedBigInteger('consultant_marketing_order_id')->nullable()->after('subscription_package_id');
            $table->unsignedBigInteger('consultant_storage_addon_id')->nullable()->after('consultant_marketing_order_id');
            $table->string('service_name')->nullable()->after('consultant_storage_addon_id');
            $table->string('payment_status', 20)->default('paid')->after('paid_at');

            $table->index('payment_category');
            $table->index('consultant_marketing_order_id');
            $table->index('consultant_storage_addon_id');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_payment_records', function (Blueprint $table) {
            $table->dropIndex(['payment_category']);
            $table->dropIndex(['consultant_marketing_order_id']);
            $table->dropIndex(['consultant_storage_addon_id']);
            $table->dropColumn([
                'payment_category',
                'consultant_marketing_order_id',
                'consultant_storage_addon_id',
                'service_name',
                'payment_status',
            ]);
        });
    }
};
