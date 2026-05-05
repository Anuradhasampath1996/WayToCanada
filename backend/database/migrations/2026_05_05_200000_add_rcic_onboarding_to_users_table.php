<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('users', function (Blueprint $table) {
            $table->string('rcic_number', 30)->nullable()->after('cicc_email')
                  ->comment('CICC college_id entered during onboarding e.g. R711248');
            $table->boolean('is_license_verified')->default(false)->after('is_verified')
                  ->comment('True after RCIC licence verified via email');
            $table->timestamp('license_verified_at')->nullable()->after('is_license_verified');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('users', function (Blueprint $table) {
            $table->dropColumn(['rcic_number', 'is_license_verified', 'license_verified_at']);
        });
    }
};
