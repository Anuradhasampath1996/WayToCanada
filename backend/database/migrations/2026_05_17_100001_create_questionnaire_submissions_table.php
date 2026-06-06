<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('questionnaire_submissions', function (Blueprint $table) {
            $table->id();

            // One submission per client user account
            $table->foreignId('user_id')
                ->unique()
                ->constrained('users')
                ->cascadeOnDelete();

            // Step 1 — General information (basic details + family structure)
            $table->json('step1_data')->nullable();

            // Step 2 — Detailed profile per family member
            $table->json('main_data')->nullable()
                ->comment('Main applicant profile including document S3 paths');

            $table->json('spouse_data')->nullable()
                ->comment('Spouse profile including document S3 paths');

            $table->json('children_data')->nullable()
                ->comment('Array of child objects, each with document S3 paths');

            $table->json('accompanying_data')->nullable()
                ->comment('Array of accompanying person objects with document S3 paths');

            // Submission lifecycle
            $table->boolean('is_submitted')->default(false);
            $table->timestamp('submitted_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('questionnaire_submissions');
    }
};
