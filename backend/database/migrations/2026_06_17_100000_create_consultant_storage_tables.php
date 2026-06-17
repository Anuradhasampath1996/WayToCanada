<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storage_addon_packages', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('extra_gb');
            $table->decimal('monthly_price', 10, 2)->nullable();
            $table->decimal('yearly_price', 10, 2)->nullable();
            $table->string('stripe_product_id')->nullable();
            $table->string('stripe_monthly_price_id')->nullable();
            $table->string('stripe_yearly_price_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('consultant_storage_addons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('storage_addon_package_id')->constrained('storage_addon_packages')->restrictOnDelete();
            $table->string('status', 20)->default('active'); // active|cancelled|expired
            $table->string('billing_cycle', 10)->nullable(); // monthly|yearly
            $table->unsignedBigInteger('extra_bytes');
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->string('stripe_customer_id')->nullable();
            $table->string('stripe_subscription_id')->nullable();
            $table->string('stripe_checkout_session_id')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        Schema::create('consultant_storage_folders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('consultant_storage_folders')->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();

            $table->unique(['user_id', 'parent_id', 'name']);
            $table->index(['user_id', 'parent_id']);
        });

        Schema::create('consultant_storage_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('folder_id')->nullable()->constrained('consultant_storage_folders')->nullOnDelete();
            $table->string('disk_path');
            $table->string('original_filename');
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes');
            $table->timestamps();

            $table->index(['user_id', 'folder_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consultant_storage_files');
        Schema::dropIfExists('consultant_storage_folders');
        Schema::dropIfExists('consultant_storage_addons');
        Schema::dropIfExists('storage_addon_packages');
    }
};
