<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('consultant_client_ai_advisories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->foreignId('consultant_id')->constrained('users')->cascadeOnDelete();
            $table->string('workflow_stage', 64);
            $table->boolean('openai_used')->default(false);
            $table->json('context_snapshot');
            $table->json('advisory_payload');
            $table->timestamps();

            $table->index(['client_profile_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('consultant_client_ai_advisories');
    }
};
