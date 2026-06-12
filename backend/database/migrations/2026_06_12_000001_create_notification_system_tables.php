<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('user_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 64);
            $table->string('title');
            $table->text('body');
            $table->string('action_url', 500)->nullable();
            $table->nullableMorphs('related');
            $table->string('dedupe_key', 128)->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at', 'created_at']);
            $table->index(['user_id', 'dedupe_key', 'created_at']);
        });

        Schema::connection('cws')->create('notification_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_notification_id')->constrained('user_notifications')->cascadeOnDelete();
            $table->string('channel', 32); // in_app, email, whatsapp
            $table->string('status', 32)->default('pending'); // pending, sent, failed, skipped
            $table->string('provider_message_id')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['user_notification_id', 'channel']);
        });

        Schema::connection('cws')->create('user_notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->boolean('in_app_enabled')->default(true);
            $table->boolean('email_enabled')->default(true);
            $table->boolean('whatsapp_enabled')->default(false);
            $table->string('whatsapp_phone', 32)->nullable();
            $table->boolean('whatsapp_verified')->default(false);
            $table->json('category_preferences')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });

        Schema::connection('cws')->create('admin_broadcasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('body');
            $table->string('action_url', 500)->nullable();
            $table->json('channels'); // ["in_app","email","whatsapp"]
            $table->string('target_type')->default('all_consultants'); // all_consultants, selected
            $table->json('target_user_ids')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->unsignedInteger('recipient_count')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('admin_broadcasts');
        Schema::connection('cws')->dropIfExists('user_notification_preferences');
        Schema::connection('cws')->dropIfExists('notification_deliveries');
        Schema::connection('cws')->dropIfExists('user_notifications');
    }
};
