<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('cws')->hasTable('learning_course_payments')) {
            return;
        }

        Schema::connection('cws')->create('learning_course_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('learner_user_id');
            $table->string('product_domain');
            $table->unsignedBigInteger('course_id');
            $table->unsignedInteger('amount_cents');
            $table->string('currency', 8)->default('CAD');
            $table->string('status')->default('pending');
            $table->string('stripe_checkout_session_id')->nullable()->unique();
            $table->string('stripe_payment_intent_id')->nullable();
            $table->unsignedInteger('access_months')->default(3);
            $table->timestamp('entitled_until')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();
            $table->index(['learner_user_id', 'product_domain', 'course_id']);
        });
    }

    public function down(): void
    {
        // Additive ledger — do not drop on product db_cws.
    }
};
