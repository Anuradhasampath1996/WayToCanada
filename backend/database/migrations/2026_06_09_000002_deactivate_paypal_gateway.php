<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('payment_gateway_settings')
            ->where('gateway', 'paypal')
            ->update(['is_active' => false, 'updated_at' => now()]);
    }

    public function down(): void
    {
        // No-op: PayPal is deprecated; do not re-activate automatically.
    }
};
