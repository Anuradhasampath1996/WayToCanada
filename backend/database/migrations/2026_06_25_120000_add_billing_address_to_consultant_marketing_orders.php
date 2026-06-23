<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('consultant_marketing_orders', function (Blueprint $table) {
            $table->string('billing_country', 8)->nullable()->after('province');
            $table->json('billing_address')->nullable()->after('billing_country');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('consultant_marketing_orders', function (Blueprint $table) {
            $table->dropColumn(['billing_country', 'billing_address']);
        });
    }
};
