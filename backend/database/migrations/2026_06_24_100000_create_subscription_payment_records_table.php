<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_payment_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('consultant_subscription_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('subscription_package_id')->nullable()->constrained()->nullOnDelete();
            $table->string('payment_type', 20)->default('initial');
            $table->string('billing_cycle', 20)->nullable();
            $table->string('stripe_invoice_id')->nullable()->unique();
            $table->string('stripe_subscription_id')->nullable()->index();
            $table->string('stripe_checkout_session_id')->nullable();
            $table->string('invoice_number')->nullable();
            $table->string('currency', 8)->default('CAD');
            $table->decimal('subtotal', 10, 2);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->decimal('total', 10, 2);
            $table->string('tax_label')->nullable();
            $table->string('tax_type', 30)->nullable();
            $table->string('province', 8)->nullable();
            $table->string('country', 8)->default('CA');
            $table->decimal('gst_amount', 10, 2)->nullable();
            $table->decimal('provincial_tax', 10, 2)->nullable();
            $table->decimal('total_rate_pct', 8, 3)->nullable();
            $table->boolean('tax_applicable')->default(true);
            $table->json('billing_address')->nullable();
            $table->string('invoice_pdf')->nullable();
            $table->string('hosted_invoice_url')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'paid_at']);
        });

        Schema::table('consultant_subscriptions', function (Blueprint $table) {
            $table->string('billing_country', 8)->nullable()->after('billing_cycle');
            $table->string('billing_province', 8)->nullable()->after('billing_country');
            $table->json('billing_address')->nullable()->after('billing_province');
        });
    }

    public function down(): void
    {
        Schema::table('consultant_subscriptions', function (Blueprint $table) {
            $table->dropColumn(['billing_country', 'billing_province', 'billing_address']);
        });

        Schema::dropIfExists('subscription_payment_records');
    }
};
