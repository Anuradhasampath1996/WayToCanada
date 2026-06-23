<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_company_settings', function (Blueprint $table) {
            $table->id();
            $table->string('legal_name')->nullable();
            $table->string('trade_name')->nullable();
            $table->string('business_number', 32)->nullable();
            $table->string('gst_hst_number', 32)->nullable();
            $table->string('qst_number', 32)->nullable();
            $table->string('pst_number', 32)->nullable();
            $table->string('address_line1')->nullable();
            $table->string('address_line2')->nullable();
            $table->string('city')->nullable();
            $table->string('province', 8)->nullable();
            $table->string('postal_code', 16)->nullable();
            $table->string('country', 8)->default('CA');
            $table->string('phone', 32)->nullable();
            $table->string('billing_email')->nullable();
            $table->string('support_email')->nullable();
            $table->string('website')->nullable();
            $table->text('invoice_footer')->nullable();
            $table->string('invoice_prefix', 16)->default('RCM');
            $table->string('logo_url')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_company_settings');
    }
};
