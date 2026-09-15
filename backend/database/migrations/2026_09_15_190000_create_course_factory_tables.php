<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'lms';

    public function up(): void
    {
        Schema::connection('lms')->create('cf_generation_runs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('admin_user_id');
            $table->unsignedBigInteger('course_id')->nullable()->index();
            $table->string('exam_name');
            $table->string('canonical_exam_name')->nullable();
            $table->string('status', 40)->default('queued')->index();
            $table->unsignedTinyInteger('overall_progress')->default(0);
            $table->string('current_step', 80)->nullable();
            $table->json('config_snapshot')->nullable();
            $table->json('provider_metadata')->nullable();
            $table->json('research_json')->nullable();
            $table->json('verification_json')->nullable();
            $table->json('coverage_report_json')->nullable();
            $table->json('stats_json')->nullable();
            $table->text('error_summary')->nullable();
            $table->string('research_version', 40)->nullable();
            $table->string('generation_version', 40)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
        });

        Schema::connection('lms')->create('cf_generation_steps', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('generation_run_id')->index();
            $table->string('step_key', 80);
            $table->string('step_name');
            $table->unsignedSmallInteger('sequence')->default(0);
            $table->string('status', 40)->default('pending')->index();
            $table->unsignedTinyInteger('progress')->default(0);
            $table->unsignedSmallInteger('retry_count')->default(0);
            $table->string('external_provider', 40)->nullable();
            $table->string('external_task_id')->nullable()->index();
            $table->string('error_code', 80)->nullable();
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedInteger('generated_records_count')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['generation_run_id', 'step_key']);
        });

        Schema::connection('lms')->create('cf_generation_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('generation_run_id')->index();
            $table->string('event_type', 80)->index();
            $table->string('level', 20)->default('info');
            $table->string('title');
            $table->text('message')->nullable();
            $table->string('agent', 80)->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();
        });

        Schema::connection('lms')->create('cf_research_sources', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('generation_run_id')->index();
            $table->unsignedBigInteger('course_id')->nullable()->index();
            $table->string('title');
            $table->text('url')->nullable();
            $table->string('organization')->nullable();
            $table->string('source_type', 60)->nullable();
            $table->unsignedTinyInteger('authority_tier')->default(3);
            $table->date('published_on')->nullable();
            $table->date('updated_on')->nullable();
            $table->timestamp('accessed_at')->nullable();
            $table->text('research_notes')->nullable();
            $table->json('relevant_topics')->nullable();
            $table->boolean('verified')->default(false);
            $table->timestamps();
        });

        Schema::connection('lms')->create('cf_exam_blueprints', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('generation_run_id')->unique();
            $table->unsignedBigInteger('course_id')->nullable()->index();
            $table->string('exam_name');
            $table->string('regulator')->nullable();
            $table->string('target_candidate')->nullable();
            $table->unsignedSmallInteger('question_count')->nullable();
            $table->unsignedSmallInteger('duration_minutes')->nullable();
            $table->json('question_formats')->nullable();
            $table->boolean('has_case_questions')->default(false);
            $table->json('domains')->nullable();
            $table->json('competencies')->nullable();
            $table->json('legislation_topics')->nullable();
            $table->json('difficulty_expectations')->nullable();
            $table->json('official_references')->nullable();
            $table->text('knowledge_cutoff_policy')->nullable();
            $table->string('source_confidence', 40)->nullable();
            $table->json('unknown_fields')->nullable();
            $table->json('raw_json')->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->timestamps();
        });

        Schema::connection('lms')->create('cf_case_bank', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('generation_run_id')->index();
            $table->unsignedBigInteger('course_id')->index();
            $table->string('case_key', 40)->nullable();
            $table->string('title');
            $table->json('profile_json')->nullable();
            $table->json('timeline_json')->nullable();
            $table->json('facts_json')->nullable();
            $table->json('issues_json')->nullable();
            $table->json('question_ids')->nullable();
            $table->string('status', 40)->default('draft');
            $table->timestamps();
        });

        Schema::connection('lms')->create('cf_mock_exam_blueprints', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('generation_run_id')->unique();
            $table->unsignedBigInteger('course_id')->index();
            $table->unsignedSmallInteger('question_count')->nullable();
            $table->unsignedSmallInteger('duration_minutes')->nullable();
            $table->json('domain_weights')->nullable();
            $table->json('difficulty_mix')->nullable();
            $table->json('question_type_mix')->nullable();
            $table->json('rules_json')->nullable();
            $table->boolean('strict_simulation')->default(true);
            $table->string('status', 40)->default('draft');
            $table->timestamps();
        });

        Schema::connection('lms')->create('cf_content_validations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('generation_run_id')->index();
            $table->string('target_type', 40);
            $table->unsignedBigInteger('target_id')->nullable();
            $table->string('validator', 40);
            $table->string('status', 40);
            $table->json('result_json')->nullable();
            $table->timestamps();
        });

        Schema::connection('lms')->create('cf_usage_records', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('generation_run_id')->index();
            $table->unsignedBigInteger('generation_step_id')->nullable()->index();
            $table->string('provider', 40);
            $table->string('model')->nullable();
            $table->unsignedInteger('request_count')->default(1);
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->unsignedInteger('image_generations')->default(0);
            $table->unsignedInteger('manus_task_count')->default(0);
            $table->decimal('estimated_cost_usd', 10, 4)->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::connection('lms')->table('lms_modules', function (Blueprint $table) {
            if (! Schema::connection('lms')->hasColumn('lms_modules', 'description')) {
                $table->text('description')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_modules', 'objectives_json')) {
                $table->json('objectives_json')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_modules', 'competency_map_json')) {
                $table->json('competency_map_json')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_modules', 'study_minutes')) {
                $table->unsignedInteger('study_minutes')->nullable();
            }
        });

        Schema::connection('lms')->table('lms_lessons', function (Blueprint $table) {
            if (! Schema::connection('lms')->hasColumn('lms_lessons', 'objectives_json')) {
                $table->json('objectives_json')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_lessons', 'references_json')) {
                $table->json('references_json')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_lessons', 'ai_metadata_json')) {
                $table->json('ai_metadata_json')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_lessons', 'last_ai_verified_at')) {
                $table->timestamp('last_ai_verified_at')->nullable();
            }
        });

        Schema::connection('lms')->table('lms_question_bank', function (Blueprint $table) {
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'module_id')) {
                $table->unsignedBigInteger('module_id')->nullable()->index();
            }
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'lesson_id')) {
                $table->unsignedBigInteger('lesson_id')->nullable()->index();
            }
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'competency')) {
                $table->string('competency')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'domain')) {
                $table->string('domain')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'subtopic')) {
                $table->string('subtopic')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'question_type')) {
                $table->string('question_type', 40)->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'status')) {
                $table->string('status', 40)->default('draft');
            }
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'distractor_explanations_json')) {
                $table->json('distractor_explanations_json')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'source_references_json')) {
                $table->json('source_references_json')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'generation_run_id')) {
                $table->unsignedBigInteger('generation_run_id')->nullable()->index();
            }
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'content_hash')) {
                $table->string('content_hash', 64)->nullable()->index();
            }
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'verification_status')) {
                $table->string('verification_status', 40)->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'last_verified_at')) {
                $table->timestamp('last_verified_at')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_question_bank', 'ai_metadata_json')) {
                $table->json('ai_metadata_json')->nullable();
            }
        });

        Schema::connection('lms')->table('lms_courses', function (Blueprint $table) {
            if (! Schema::connection('lms')->hasColumn('lms_courses', 'short_description')) {
                $table->text('short_description')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_courses', 'learning_objectives_json')) {
                $table->json('learning_objectives_json')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_courses', 'estimated_hours')) {
                $table->decimal('estimated_hours', 6, 1)->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_courses', 'difficulty')) {
                $table->string('difficulty', 40)->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_courses', 'regulator')) {
                $table->string('regulator')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_courses', 'tags_json')) {
                $table->json('tags_json')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_courses', 'seo_json')) {
                $table->json('seo_json')->nullable();
            }
            if (! Schema::connection('lms')->hasColumn('lms_courses', 'cf_generation_run_id')) {
                $table->unsignedBigInteger('cf_generation_run_id')->nullable()->index();
            }
        });
    }

    public function down(): void
    {
        Schema::connection('lms')->dropIfExists('cf_usage_records');
        Schema::connection('lms')->dropIfExists('cf_content_validations');
        Schema::connection('lms')->dropIfExists('cf_mock_exam_blueprints');
        Schema::connection('lms')->dropIfExists('cf_case_bank');
        Schema::connection('lms')->dropIfExists('cf_exam_blueprints');
        Schema::connection('lms')->dropIfExists('cf_research_sources');
        Schema::connection('lms')->dropIfExists('cf_generation_events');
        Schema::connection('lms')->dropIfExists('cf_generation_steps');
        Schema::connection('lms')->dropIfExists('cf_generation_runs');
    }
};
