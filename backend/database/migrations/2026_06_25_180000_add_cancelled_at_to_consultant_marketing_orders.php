<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->table('consultant_marketing_orders', function (Blueprint $table) {
            $table->timestamp('cancelled_at')->nullable()->after('ends_at');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('consultant_marketing_orders', function (Blueprint $table) {
            $table->dropColumn('cancelled_at');
        });
    }
};
