<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('document_submissions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('case_file_id')
                ->constrained('case_files')
                ->cascadeOnDelete();

            // The user who uploaded this (client's user ID)
            $table->foreignId('uploaded_by')
                ->constrained('users')
                ->cascadeOnDelete();

            // Document type key — e.g. "passport", "ielts_results", "eca"
            $table->string('document_type');

            // Display label — e.g. "Valid Passport (all pages)"
            $table->string('document_label');

            // Storage path (relative to public disk)
            $table->string('file_path');

            // Original filename from upload
            $table->string('original_filename');

            // MIME type
            $table->string('mime_type')->nullable();

            // File size in bytes
            $table->unsignedBigInteger('file_size')->nullable();

            /*
             * Status pipeline:
             *   pending_review     — just uploaded, waiting for AI scan
             *   under_ai_review    — sent to AI service, waiting for result
             *   ai_verified        — AI confirmed, auto-approved
             *   ai_flagged         — AI found mismatch, needs consultant review
             *   consultant_approved — consultant manually approved
             *   consultant_rejected — consultant rejected with comment
             */
            $table->string('status')->default('pending_review');

            // AI scan result (raw JSON from OCR service)
            $table->json('ai_result')->nullable();

            // AI confidence score (0.0 – 1.0)
            $table->decimal('ai_confidence', 4, 3)->nullable();

            // AI extracted fields matched to questionnaire (JSON diff)
            $table->json('ai_match_result')->nullable();

            // Consultant's rejection comment
            $table->text('rejection_comment')->nullable();

            // Consultant who reviewed
            $table->foreignId('reviewed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('reviewed_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('document_submissions');
    }
};
