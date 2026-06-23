<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_gateway_settings', function (Blueprint $table) {
            $table->timestamp('last_webhook_at')->nullable()->after('webhook_id');
            $table->string('last_webhook_type')->nullable()->after('last_webhook_at');
            $table->string('last_webhook_account')->nullable()->after('last_webhook_type');
        });
    }

    public function down(): void
    {
        Schema::table('payment_gateway_settings', function (Blueprint $table) {
            $table->dropColumn(['last_webhook_at', 'last_webhook_type', 'last_webhook_account']);
        });
    }
};
