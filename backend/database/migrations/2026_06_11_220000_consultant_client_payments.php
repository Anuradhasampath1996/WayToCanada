<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('consultant_payment_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('stripe_connect_account_id')->nullable();
            $table->boolean('stripe_charges_enabled')->default(false);
            $table->boolean('stripe_details_submitted')->default(false);
            $table->string('paypal_email')->nullable();
            $table->string('paypal_me_username')->nullable();
            $table->string('interac_email')->nullable();
            $table->string('preferred_provider')->default('stripe'); // stripe, paypal, interac
            $table->timestamps();
            $table->unique('user_id');
        });

        Schema::connection('cws')->create('client_payment_requests', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->foreignId('case_file_id')->constrained('case_files')->cascadeOnDelete();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->foreignId('consultant_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('CAD');
            $table->string('provider'); // stripe, paypal, interac
            $table->string('status')->default('pending'); // pending, paid, cancelled, awaiting_confirmation
            $table->string('stripe_checkout_session_id')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->index(['client_profile_id', 'status']);
            $table->index(['consultant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('client_payment_requests');
        Schema::connection('cws')->dropIfExists('consultant_payment_accounts');
    }
};
