<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('whatsapp_conversations', function (Blueprint $table) {
            $table->id();
            $table->string('wa_id', 32)->unique();
            $table->string('contact_name')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('last_message_at')->nullable();
            $table->string('last_message_preview', 500)->nullable();
            $table->unsignedInteger('unread_count')->default(0);
            $table->timestamp('session_expires_at')->nullable();
            $table->timestamps();

            $table->index(['last_message_at', 'id']);
        });

        Schema::connection('cws')->create('whatsapp_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('whatsapp_conversation_id')->constrained('whatsapp_conversations')->cascadeOnDelete();
            $table->string('direction', 16); // inbound, outbound
            $table->string('wa_message_id', 128)->nullable()->unique();
            $table->string('message_type', 32)->default('text');
            $table->text('body')->nullable();
            $table->string('status', 32)->default('received');
            $table->foreignId('sent_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['whatsapp_conversation_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('whatsapp_messages');
        Schema::connection('cws')->dropIfExists('whatsapp_conversations');
    }
};
