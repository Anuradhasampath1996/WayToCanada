<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('consultant_meeting_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('preferred_provider')->default('google_meet'); // google_meet, zoom, teams
            $table->string('google_meet_url')->nullable();
            $table->string('zoom_meeting_url')->nullable();
            $table->string('teams_meeting_url')->nullable();
            $table->timestamps();
            $table->unique('user_id');
        });

        Schema::connection('cws')->create('client_meetings', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->foreignId('case_file_id')->constrained('case_files')->cascadeOnDelete();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->foreignId('consultant_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->timestamp('scheduled_at');
            $table->unsignedSmallInteger('duration_minutes')->default(60);
            $table->string('timezone')->default('America/Toronto');
            $table->string('provider'); // google_meet, zoom, teams
            $table->string('meeting_url');
            $table->string('status')->default('scheduled'); // scheduled, cancelled, completed
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->index(['client_profile_id', 'scheduled_at']);
            $table->index(['consultant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('client_meetings');
        Schema::connection('cws')->dropIfExists('consultant_meeting_accounts');
    }
};
