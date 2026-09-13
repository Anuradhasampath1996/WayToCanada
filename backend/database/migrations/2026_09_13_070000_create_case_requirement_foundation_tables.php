<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('pathway_requirement_definitions', function (Blueprint $table) {
            $table->id();
            $table->string('registry_key', 80)->index();
            $table->string('family', 64)->nullable()->index();
            $table->unsignedInteger('version');
            $table->timestamp('effective_from');
            $table->timestamp('effective_to')->nullable();
            $table->string('source_name')->nullable();
            $table->text('source_reference')->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->json('definition');
            $table->boolean('is_published')->default(true);
            $table->timestamps();

            $table->unique(['registry_key', 'version']);
        });

        Schema::connection('cws')->create('case_requirement_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_file_id')->constrained('case_files')->cascadeOnDelete();
            $table->foreignId('pathway_requirement_definition_id')->nullable()
                ->constrained('pathway_requirement_definitions')->nullOnDelete();
            $table->unsignedInteger('plan_version');
            $table->unsignedInteger('registry_version')->nullable();
            $table->string('registry_key', 80)->nullable();
            $table->string('pathway_code', 64)->nullable()->index();
            $table->string('pathway_label')->nullable();
            $table->string('status', 24)->default('current'); // current | superseded
            $table->json('snapshot');
            $table->foreignId('previous_plan_id')->nullable()
                ->constrained('case_requirement_plans')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('change_reason', 64)->nullable(); // assign | pathway_change | registry_update | clear
            $table->text('change_note')->nullable();
            $table->timestamps();

            $table->index(['case_file_id', 'status']);
            $table->unique(['case_file_id', 'plan_version']);
        });

        Schema::connection('cws')->create('case_history_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_file_id')->constrained('case_files')->cascadeOnDelete();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event_type', 64);
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['case_file_id', 'occurred_at']);
            $table->index(['case_file_id', 'event_type']);
        });

        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->foreignId('current_requirement_plan_id')->nullable()
                ->after('pathway_assessment_at')
                ->constrained('case_requirement_plans')->nullOnDelete();
            $table->string('workflow_status', 64)->nullable()->after('status')->index();
            $table->string('confirmed_submission_portal', 64)->nullable()->after('workflow_status');
            $table->timestamp('consultation_completed_at')->nullable();
            $table->timestamp('consultation_skipped_at')->nullable();
            $table->string('consultation_skip_reason', 500)->nullable();
            $table->timestamp('profile_reviewed_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropConstrainedForeignId('current_requirement_plan_id');
            $table->dropColumn([
                'workflow_status',
                'confirmed_submission_portal',
                'consultation_completed_at',
                'consultation_skipped_at',
                'consultation_skip_reason',
                'profile_reviewed_at',
            ]);
        });

        Schema::connection('cws')->dropIfExists('case_history_events');
        Schema::connection('cws')->dropIfExists('case_requirement_plans');
        Schema::connection('cws')->dropIfExists('pathway_requirement_definitions');
    }
};
