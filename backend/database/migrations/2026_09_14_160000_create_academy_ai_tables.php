<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection('academy');

        $this->addProvenance($schema, 'academy_course_versions');
        $this->addProvenance($schema, 'academy_question_versions');
        $this->addProvenance($schema, 'academy_case_versions');
        $this->addProvenance($schema, 'academy_lessons');

        if (! $schema->hasTable('academy_ai_generation_jobs')) {
            $schema->create('academy_ai_generation_jobs', function (Blueprint $table) {
                $table->id();
                $table->string('type'); // course, questions, cases, mock_pool, regenerate, images, revalidate
                $table->string('status')->default('queued');
                $table->unsignedBigInteger('requested_by');
                $table->unsignedBigInteger('track_id')->nullable();
                $table->unsignedBigInteger('exam_template_id')->nullable();
                $table->unsignedBigInteger('course_id')->nullable();
                $table->unsignedBigInteger('course_version_id')->nullable();
                $table->string('title')->nullable();
                $table->text('goal')->nullable();
                $table->string('difficulty')->nullable();
                $table->decimal('estimated_hours', 6, 1)->nullable();
                $table->json('request_json')->nullable();
                $table->json('blueprint_json')->nullable();
                $table->boolean('blueprint_approved')->default(false);
                $table->json('progress_json')->nullable();
                $table->string('research_provider')->nullable();
                $table->string('generation_provider')->nullable();
                $table->text('error')->nullable();
                $table->string('cancel_requested')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('academy_ai_generation_steps')) {
            $schema->create('academy_ai_generation_steps', function (Blueprint $table) {
                $table->id();
                $table->foreignId('generation_job_id')->constrained('academy_ai_generation_jobs')->cascadeOnDelete();
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

        if (! $schema->hasTable('academy_ai_source_packs')) {
            $schema->create('academy_ai_source_packs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('generation_job_id')->constrained('academy_ai_generation_jobs')->cascadeOnDelete();
                $table->string('status')->default('draft');
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('academy_ai_source_pack_items')) {
            $schema->create('academy_ai_source_pack_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('source_pack_id')->constrained('academy_ai_source_packs')->cascadeOnDelete();
                $table->string('item_type'); // academy_source, url, upload, legislation_hub, manus_candidate
                $table->unsignedBigInteger('legal_source_id')->nullable();
                $table->unsignedBigInteger('legislation_document_id')->nullable();
                $table->string('url', 1500)->nullable();
                $table->string('title')->nullable();
                $table->string('organization')->nullable();
                $table->string('storage_disk')->nullable();
                $table->string('storage_path', 1000)->nullable();
                $table->boolean('admin_trusted_host')->default(false);
                $table->json('meta_json')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('academy_ai_source_snapshots')) {
            $schema->create('academy_ai_source_snapshots', function (Blueprint $table) {
                $table->id();
                $table->foreignId('generation_job_id')->constrained('academy_ai_generation_jobs')->cascadeOnDelete();
                $table->unsignedBigInteger('legal_source_id')->nullable();
                $table->unsignedBigInteger('pack_item_id')->nullable();
                $table->string('title')->nullable();
                $table->string('url', 1500)->nullable();
                $table->string('organization')->nullable();
                $table->string('version_label')->nullable();
                $table->date('effective_date')->nullable();
                $table->timestamp('last_verified_at')->nullable();
                $table->timestamp('retrieved_at');
                $table->string('content_hash', 64);
                $table->string('storage_disk')->nullable();
                $table->string('storage_path', 1000)->nullable();
                $table->text('excerpt')->nullable();
                $table->string('retrieval_method');
                $table->boolean('allowlisted')->default(true);
                $table->boolean('authoritative')->default(false);
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('academy_ai_generated_items')) {
            $schema->create('academy_ai_generated_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('generation_job_id')->constrained('academy_ai_generation_jobs')->cascadeOnDelete();
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
                $table->unique(['generation_job_id', 'item_type', 'idempotency_key'], 'academy_ai_items_idempotent');
            });
        }

        if (! $schema->hasTable('academy_ai_validation_results')) {
            $schema->create('academy_ai_validation_results', function (Blueprint $table) {
                $table->id();
                $table->foreignId('generated_item_id')->constrained('academy_ai_generated_items')->cascadeOnDelete();
                $table->boolean('structural_ok')->default(false);
                $table->boolean('grounding_ok')->default(false);
                $table->boolean('agrees_with_generated')->nullable();
                $table->boolean('ambiguous')->default(false);
                $table->boolean('currency_ok')->default(true);
                $table->string('validator_option_key')->nullable();
                $table->string('generated_option_key')->nullable();
                $table->decimal('source_grounding_score', 5, 2)->nullable();
                $table->decimal('answer_consistency_score', 5, 2)->nullable();
                $table->decimal('ambiguity_score', 5, 2)->nullable();
                $table->decimal('citation_coverage_score', 5, 2)->nullable();
                $table->string('admin_label')->nullable();
                $table->json('flags_json')->nullable();
                $table->json('validator_payload_json')->nullable();
                $table->string('validator_model')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('academy_ai_usage_records')) {
            $schema->create('academy_ai_usage_records', function (Blueprint $table) {
                $table->id();
                $table->foreignId('generation_job_id')->nullable()->constrained('academy_ai_generation_jobs')->nullOnDelete();
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
                $table->decimal('actual_cost_usd', 10, 4)->nullable();
                $table->boolean('cost_is_estimated')->default(true);
                $table->json('meta_json')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('academy_ai_prompt_runs')) {
            $schema->create('academy_ai_prompt_runs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('generation_job_id')->nullable();
                $table->unsignedBigInteger('step_id')->nullable();
                $table->string('prompt_key');
                $table->string('prompt_version');
                $table->string('prompt_hash', 64);
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('academy_ai_media')) {
            $schema->create('academy_ai_media', function (Blueprint $table) {
                $table->id();
                $table->foreignId('generation_job_id')->constrained('academy_ai_generation_jobs')->cascadeOnDelete();
                $table->string('kind');
                $table->text('prompt');
                $table->string('provider');
                $table->string('model')->nullable();
                $table->string('storage_disk')->nullable();
                $table->string('storage_path', 1000)->nullable();
                $table->string('approval_status')->default('pending');
                $table->string('associated_type')->nullable();
                $table->unsignedBigInteger('associated_id')->nullable();
                $table->decimal('estimated_cost_usd', 10, 4)->nullable();
                $table->timestamp('generated_at')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('academy_ai_settings')) {
            $schema->create('academy_ai_settings', function (Blueprint $table) {
                $table->id();
                $table->decimal('monthly_budget_usd', 10, 2)->nullable();
                $table->unsignedInteger('max_questions_per_job')->nullable();
                $table->unsignedInteger('max_source_chars')->nullable();
                $table->unsignedInteger('batch_size')->nullable();
                $table->unsignedInteger('image_limit_per_job')->nullable();
                $table->unsignedInteger('budget_warn_percent')->nullable();
                $table->boolean('manus_enabled_override')->nullable();
                $table->json('allowed_models_json')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('academy_ai_manus_events')) {
            $schema->create('academy_ai_manus_events', function (Blueprint $table) {
                $table->id();
                $table->string('event_key')->unique();
                $table->string('task_id')->nullable();
                $table->string('request_id')->nullable();
                $table->string('status')->nullable();
                $table->json('payload_json')->nullable();
                $table->timestamp('processed_at')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        $schema = Schema::connection('academy');
        foreach ([
            'academy_ai_manus_events',
            'academy_ai_settings',
            'academy_ai_media',
            'academy_ai_prompt_runs',
            'academy_ai_usage_records',
            'academy_ai_validation_results',
            'academy_ai_generated_items',
            'academy_ai_source_snapshots',
            'academy_ai_source_pack_items',
            'academy_ai_source_packs',
            'academy_ai_generation_steps',
            'academy_ai_generation_jobs',
        ] as $table) {
            $schema->dropIfExists($table);
        }
    }

    private function addProvenance($schema, string $table): void
    {
        if (! $schema->hasTable($table) || $schema->hasColumn($table, 'generated_by_ai')) {
            return;
        }

        $schema->table($table, function (Blueprint $blueprint) {
            $blueprint->boolean('generated_by_ai')->default(false);
            $blueprint->unsignedBigInteger('ai_generation_job_id')->nullable();
            $blueprint->string('ai_prompt_version')->nullable();
        });
    }
};
