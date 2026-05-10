<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consultant_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('subscription_package_id')->constrained('subscription_packages')->onDelete('restrict');
            $table->enum('status', ['trial', 'active', 'expired', 'payment_declined', 'cancelled'])->default('trial');
            $table->boolean('is_trial')->default(false);
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->enum('billing_cycle', ['monthly', 'yearly'])->nullable();
            $table->timestamp('last_payment_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consultant_subscriptions');
    }
};
