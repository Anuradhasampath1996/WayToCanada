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
        if (! $schema->hasTable('subscription_payment_records')) {
            return;
        }

        if (! $schema->hasColumn('subscription_payment_records', 'wallet_credit_amount')) {
            $schema->table('subscription_payment_records', function (Blueprint $table) {
                $table->decimal('wallet_credit_amount', 12, 2)->default(0)->after('total');
            });
        }
    }

    public function down(): void
    {
        $schema = Schema::connection('cws');
        if ($schema->hasColumn('subscription_payment_records', 'wallet_credit_amount')) {
            $schema->table('subscription_payment_records', function (Blueprint $table) {
                $table->dropColumn('wallet_credit_amount');
            });
        }
    }
};
