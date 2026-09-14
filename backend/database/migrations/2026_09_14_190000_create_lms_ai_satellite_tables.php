<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection('lms');

        if ($schema->hasTable('lms_ai_generation_jobs') && ! $schema->hasColumn('lms_ai_generation_jobs', 'cancel_requested')) {
            $schema->table('lms_ai_generation_jobs', function (Blueprint $table) {
                $table->string('cancel_requested')->nullable();
            });
        }

        if (! $schema->hasTable('lms_ai_generation_steps')) {
            $schema->create('lms_ai_generation_steps', function (Blueprint $table) {
                $table->id();
                $table->foreignId('generation_job_id')->constrained('lms_ai_generation_jobs')->cascadeOnDelete();
                $table->string('stage');
                $table->string('status')->default('queued');
                $table->unsignedInteger('attempt')->default(0);
                $table->string('provider')->nullable();
                $table->string('model')->nullable();
                $table->string('prompt_key')->nullable();
                $table->string('prompt_version')->nullable();
                $table->json('input_ref_json')->nullable();
                $table->json('output_ref_json')->nullable();
                $table->string('manus_task_id')->nullable();
                $table->string('manus_request_id')->nullable();
                $table->text('error')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('lms_ai_source_snapshots')) {
            $schema->create('lms_ai_source_snapshots', function (Blueprint $table) {
                $table->id();
                $table->foreignId('generation_job_id')->constrained('lms_ai_generation_jobs')->cascadeOnDelete();
                $table->unsignedBigInteger('evidence_item_id')->nullable();
                $table->string('title')->nullable();
                $table->string('url', 1500)->nullable();
                $table->string('organization')->nullable();
                $table->string('version_label')->nullable();
                $table->timestamp('retrieved_at')->nullable();
                $table->string('content_hash', 128)->nullable();
                $table->text('excerpt')->nullable();
                $table->string('retrieval_method')->default('evidence_pack');
                $table->boolean('allowlisted')->default(false);
                $table->boolean('authoritative')->default(false);
                $table->boolean('candidate_only')->default(false);
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('lms_ai_generated_items')) {
            $schema->create('lms_ai_generated_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('generation_job_id')->constrained('lms_ai_generation_jobs')->cascadeOnDelete();
                $table->string('item_type');
                $table->string('idempotency_key');
                $table->string('status')->default('generated');
                $table->json('payload_json')->nullable();
                $table->string('entity_type')->nullable();
                $table->unsignedBigInteger('entity_id')->nullable();
                $table->string('prompt_key')->nullable();
                $table->string('prompt_version')->nullable();
                $table->string('provider')->nullable();
                $table->string('model')->nullable();
                $table->boolean('citation_unverified')->default(false);
                $table->string('admin_label')->nullable();
                $table->timestamps();
                $table->unique(['generation_job_id', 'item_type', 'idempotency_key'], 'lms_ai_items_idempotent');
            });
        }

        if (! $schema->hasTable('lms_ai_validation_results')) {
            $schema->create('lms_ai_validation_results', function (Blueprint $table) {
                $table->id();
                $table->foreignId('generated_item_id')->constrained('lms_ai_generated_items')->cascadeOnDelete();
                $table->boolean('structural_ok')->default(false);
                $table->boolean('grounding_ok')->default(false);
                $table->boolean('agrees_with_generated')->nullable();
                $table->boolean('ambiguous')->default(false);
                $table->json('flags_json')->nullable();
                $table->json('validator_payload_json')->nullable();
                $table->string('validator_model')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('lms_ai_usage_records')) {
            $schema->create('lms_ai_usage_records', function (Blueprint $table) {
                $table->id();
                $table->foreignId('generation_job_id')->nullable()->constrained('lms_ai_generation_jobs')->nullOnDelete();
                $table->unsignedBigInteger('step_id')->nullable();
                $table->string('provider');
                $table->string('operation');
                $table->string('model')->nullable();
                $table->string('prompt_version')->nullable();
                $table->string('provider_request_id')->nullable();
                $table->string('provider_task_id')->nullable();
                $table->unsignedInteger('input_tokens')->nullable();
                $table->unsignedInteger('output_tokens')->nullable();
                $table->decimal('estimated_cost_usd', 10, 4)->nullable();
                $table->boolean('cost_is_estimated')->default(true);
                $table->json('meta_json')->nullable();
                $table->timestamps();
            });
        }

        if ($schema->hasTable('lms_courses') && ! $schema->hasColumn('lms_courses', 'generation_job_id')) {
            $schema->table('lms_courses', function (Blueprint $table) {
                $table->unsignedBigInteger('generation_job_id')->nullable();
            });
        }

        if ($schema->hasTable('lms_exam_templates') && ! $schema->hasColumn('lms_exam_templates', 'generation_job_id')) {
            $schema->table('lms_exam_templates', function (Blueprint $table) {
                $table->unsignedBigInteger('generation_job_id')->nullable();
            });
        }
    }

    public function down(): void
    {
        // Additive — never drop on product db_lms.
    }
};
