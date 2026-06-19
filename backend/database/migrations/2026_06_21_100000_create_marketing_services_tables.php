<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('marketing_services', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('tagline')->nullable();
            $table->text('summary')->nullable();
            $table->longText('detail_body')->nullable();
            $table->json('features')->nullable();
            $table->decimal('price', 10, 2)->default(0);
            $table->string('price_label')->default('one-time');
            $table->string('billing_type')->default('one_time');
            $table->string('stripe_product_id')->nullable();
            $table->string('stripe_price_id')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::connection('cws')->create('consultant_marketing_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('marketing_service_id')->constrained('marketing_services')->cascadeOnDelete();
            $table->string('status')->default('pending');
            $table->decimal('amount', 10, 2);
            $table->string('billing_type');
            $table->string('province', 8)->nullable();
            $table->decimal('tax_amount', 10, 2)->nullable();
            $table->string('stripe_checkout_session_id')->nullable()->index();
            $table->string('stripe_subscription_id')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'marketing_service_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('consultant_marketing_orders');
        Schema::connection('cws')->dropIfExists('marketing_services');
    }
};
