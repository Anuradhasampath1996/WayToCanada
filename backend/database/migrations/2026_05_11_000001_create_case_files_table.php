<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('case_files', function (Blueprint $table) {
            $table->id();

            $table->foreignId('client_profile_id')
                ->unique()
                ->constrained('client_profiles')
                ->cascadeOnDelete();

            $table->foreignId('consultant_id')
                ->constrained('users')
                ->cascadeOnDelete();

            /*
             * Workflow status — ordered progression:
             * PENDING_ASSESSMENT → PATHWAY_SELECTED → AGREEMENT_SENT → AGREEMENT_SIGNED
             */
            $table->string('status')->default('PENDING_ASSESSMENT');

            // Step 1 — Pathway chosen by consultant
            $table->string('immigration_pathway')->nullable();

            // Step 2 — Retainer Agreement
            $table->string('agreement_token', 64)->nullable()->unique();
            $table->timestamp('agreement_sent_at')->nullable();
            $table->timestamp('agreement_signed_at')->nullable();

            // Step 4 — Document / form tracking (JSON checklist state)
            $table->json('checklist_data')->nullable()
                ->comment('Key-value map of document IDs to true/false');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('case_files');
    }
};
