<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('case_government_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('case_file_id');
            $table->unsignedBigInteger('client_profile_id');
            $table->string('type', 40);
            $table->string('custom_label', 255)->nullable();
            $table->string('status', 40)->default('open');
            $table->timestamp('due_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('client_notified_at')->nullable();
            $table->timestamp('answered_at')->nullable();
            $table->unsignedBigInteger('answered_by')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->index(['case_file_id', 'status']);
            $table->index(['due_at']);
        });

        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->string('decision_status', 40)->nullable();
            $table->timestamp('decision_at')->nullable();
            $table->string('decision_letter_path', 500)->nullable();
            $table->text('decision_note')->nullable();
            $table->text('next_step_note')->nullable();
            $table->json('closure_checklist')->nullable();
            $table->timestamp('closure_reviewed_at')->nullable();
            $table->unsignedBigInteger('closure_reviewed_by')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropColumn([
                'decision_status',
                'decision_at',
                'decision_letter_path',
                'decision_note',
                'next_step_note',
                'closure_checklist',
                'closure_reviewed_at',
                'closure_reviewed_by',
            ]);
        });
        Schema::connection('cws')->dropIfExists('case_government_requests');
    }
};
