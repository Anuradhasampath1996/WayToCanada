<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('consultant_client_ai_chat_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->foreignId('consultant_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 16);
            $table->text('content');
            $table->boolean('openai_used')->nullable();
            $table->timestamps();

            $table->index(['client_profile_id', 'consultant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('consultant_client_ai_chat_messages');
    }
};
