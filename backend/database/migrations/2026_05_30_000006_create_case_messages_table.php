<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('case_messages', function (Blueprint $table) {
            $table->id();

            $table->foreignId('case_file_id')
                ->constrained('case_files')
                ->cascadeOnDelete();

            // The user who sent the message
            $table->foreignId('sender_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // 'consultant' or 'client'
            $table->string('sender_type');

            $table->text('message');

            // For document-linked messages (rejection comments)
            $table->foreignId('document_submission_id')
                ->nullable()
                ->constrained('document_submissions')
                ->nullOnDelete();

            // Timestamp when the other party read this message
            $table->timestamp('read_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('case_messages');
    }
};
