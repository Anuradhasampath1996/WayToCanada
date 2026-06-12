<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('client_activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->foreignId('case_file_id')->nullable()->constrained('case_files')->nullOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_type', 32); // client, consultant, system
            $table->string('actor_name')->nullable();
            $table->string('event_type', 64);
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('dedupe_key', 128)->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->unique(['client_profile_id', 'dedupe_key']);
            $table->index(['client_profile_id', 'occurred_at']);
            $table->index(['client_profile_id', 'event_type']);
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('client_activity_logs');
    }
};
