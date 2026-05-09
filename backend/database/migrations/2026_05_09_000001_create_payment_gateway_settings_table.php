<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_gateway_settings', function (Blueprint $table) {
            $table->id();
            $table->enum('gateway', ['stripe', 'paypal'])->unique();
            $table->enum('mode', ['test', 'production'])->default('test');
            $table->boolean('is_active')->default(false);
            // Stored encrypted; nullable until admin saves them
            $table->text('publishable_key')->nullable(); // Stripe publishable / PayPal client_id
            $table->text('secret_key')->nullable();      // Stripe secret / PayPal secret
            $table->timestamps();
        });

        // Seed default rows so the admin page always has something to update
        DB::table('payment_gateway_settings')->insert([
            ['gateway' => 'stripe', 'mode' => 'test', 'is_active' => false, 'publishable_key' => null, 'secret_key' => null, 'created_at' => now(), 'updated_at' => now()],
            ['gateway' => 'paypal', 'mode' => 'test', 'is_active' => false, 'publishable_key' => null, 'secret_key' => null, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_gateway_settings');
    }
};
