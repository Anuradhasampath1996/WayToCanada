<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ircc_interactive_form_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ircc_interactive_form_id')
                ->constrained('ircc_interactive_forms')
                ->cascadeOnDelete();
            $table->foreignId('case_file_id')
                ->constrained('case_files')
                ->cascadeOnDelete();
            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->json('response_data')->nullable();
            $table->string('status')->default('draft'); // draft | submitted
            $table->timestamp('submitted_at')->nullable();
            $table->text('consultant_notes')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamps();

            $table->unique(['case_file_id', 'ircc_interactive_form_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ircc_interactive_form_responses');
    }
};
