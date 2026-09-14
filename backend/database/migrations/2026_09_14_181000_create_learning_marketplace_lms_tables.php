<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection('lms');

        if (! $schema->hasTable('lms_exams')) {
            $schema->create('lms_exams', function (Blueprint $table) {
                $table->id();
                $table->string('product_domain')->default('client_lms');
                $table->string('audience')->default('client');
                $table->string('key')->unique();
                $table->string('slug')->unique();
                $table->string('generation_profile')->default('language_exam_prep');
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('exam_authority')->nullable();
                $table->string('official_exam_url', 1000)->nullable();
                $table->string('content_language')->default('en');
                $table->unsignedBigInteger('category_id')->nullable();
                $table->string('status')->default('draft');
                $table->string('thumbnail_url', 1000)->nullable();
                $table->json('exam_format_json')->nullable();
                $table->json('source_requirements_json')->nullable();
                $table->string('structure_verification_status')->default('unverified');
                $table->unsignedBigInteger('structure_entered_by')->nullable();
                $table->timestamp('structure_entered_at')->nullable();
                $table->text('structure_entered_reason')->nullable();
                $table->string('structure_supporting_url', 1000)->nullable();
                $table->timestamp('last_verified_at')->nullable();
                $table->timestamp('next_review_at')->nullable();
                $table->string('stale_reason')->nullable();
                $table->unsignedInteger('verification_interval_days')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('lms_exam_translations')) {
            $schema->create('lms_exam_translations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_id')->constrained('lms_exams')->cascadeOnDelete();
                $table->string('locale', 8);
                $table->string('name');
                $table->text('description')->nullable();
                $table->timestamps();
                $table->unique(['exam_id', 'locale']);
            });
        }

        if (! $schema->hasTable('lms_exam_field_audits')) {
            $schema->create('lms_exam_field_audits', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_id')->constrained('lms_exams')->cascadeOnDelete();
                $table->unsignedBigInteger('actor_user_id');
                $table->string('field');
                $table->text('previous_value')->nullable();
                $table->text('new_value')->nullable();
                $table->text('reason')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('lms_exam_evidence_packs')) {
            $schema->create('lms_exam_evidence_packs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_id')->constrained('lms_exams')->cascadeOnDelete();
                $table->string('product_domain')->default('client_lms');
                $table->timestamp('researched_at')->nullable();
                $table->string('research_provider')->nullable();
                $table->timestamp('last_verified_at')->nullable();
                $table->timestamp('next_review_at')->nullable();
                $table->string('stale_reason')->nullable();
                $table->unsignedInteger('source_count')->default(0);
                $table->unsignedInteger('official_source_count')->default(0);
                $table->unsignedInteger('official_sample_paper_count')->default(0);
                $table->unsignedInteger('public_past_paper_count')->default(0);
                $table->boolean('blueprint_found')->default(false);
                $table->boolean('syllabus_found')->default(false);
                $table->boolean('competency_framework_found')->default(false);
                $table->boolean('exam_structure_verified')->default(false);
                $table->boolean('critical_structure_unverified')->default(true);
                $table->string('current_format_confidence')->nullable();
                $table->unsignedInteger('unresolved_conflict_count')->default(0);
                $table->json('unresolved_conflicts_json')->nullable();
                $table->text('research_summary')->nullable();
                $table->string('status')->default('researching');
                $table->json('manus_research_json')->nullable();
                $table->json('openai_verification_json')->nullable();
                $table->json('coverage_json')->nullable();
                $table->json('pattern_metadata_json')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('lms_exam_evidence_items')) {
            $schema->create('lms_exam_evidence_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('pack_id')->constrained('lms_exam_evidence_packs')->cascadeOnDelete();
                $table->string('source_type')->nullable();
                $table->string('authority')->nullable();
                $table->string('url', 2000)->nullable();
                $table->string('title')->nullable();
                $table->date('publication_date')->nullable();
                $table->date('effective_date')->nullable();
                $table->string('version_label')->nullable();
                $table->timestamp('retrieved_at')->nullable();
                $table->string('content_hash', 128)->nullable();
                $table->boolean('is_official')->default(false);
                $table->string('verification_status')->default('unverified');
                $table->string('usage_permission_status')->default('permission_unknown');
                $table->boolean('robots_txt_allowed')->nullable();
                $table->string('snapshot_disk')->nullable();
                $table->string('snapshot_path', 1000)->nullable();
                $table->boolean('full_file_stored')->default(false);
                $table->text('excerpt')->nullable();
                $table->json('pattern_metadata_json')->nullable();
                $table->boolean('disabled')->default(false);
                $table->string('classification_flag')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('lms_exam_generation_overrides')) {
            $schema->create('lms_exam_generation_overrides', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_id')->constrained('lms_exams')->cascadeOnDelete();
                $table->unsignedBigInteger('actor_user_id');
                $table->string('warning_code');
                $table->text('reason');
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('lms_exam_questions')) {
            $schema->create('lms_exam_questions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_id')->constrained('lms_exams')->cascadeOnDelete();
                $table->string('type')->default('independent_mcq');
                $table->string('status')->default('draft');
                $table->unsignedBigInteger('current_published_version_id')->nullable();
                $table->unsignedBigInteger('generation_job_id')->nullable();
                $table->string('generation_profile')->nullable();
                $table->string('style_pattern_category')->nullable();
                $table->boolean('practice_eligible')->default(true);
                $table->boolean('mock_eligible')->default(true);
                $table->string('content_language')->default('en');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('lms_exam_question_versions')) {
            $schema->create('lms_exam_question_versions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('question_id')->constrained('lms_exam_questions')->cascadeOnDelete();
                $table->unsignedInteger('version_number');
                $table->longText('question_text');
                $table->longText('explanation')->nullable();
                $table->string('difficulty')->default('medium');
                $table->string('status')->default('draft');
                $table->json('provenance_json')->nullable();
                $table->json('evidence_item_ids_json')->nullable();
                $table->json('validation_flags_json')->nullable();
                $table->json('topics_json')->nullable();
                $table->json('competencies_json')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamp('published_at')->nullable();
                $table->timestamps();
                $table->unique(['question_id', 'version_number']);
            });
        }

        if (! $schema->hasTable('lms_exam_question_options')) {
            $schema->create('lms_exam_question_options', function (Blueprint $table) {
                $table->id();
                $table->foreignId('question_version_id')->constrained('lms_exam_question_versions')->cascadeOnDelete();
                $table->string('option_key', 8);
                $table->text('option_text');
                $table->boolean('is_correct')->default(false);
                $table->text('incorrect_explanation')->nullable();
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('lms_course_questions')) {
            $schema->create('lms_course_questions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('course_id')->constrained('lms_courses')->cascadeOnDelete();
                $table->foreignId('question_id')->constrained('lms_exam_questions')->cascadeOnDelete();
                $table->boolean('practice_eligible')->default(true);
                $table->boolean('mock_eligible')->default(true);
                $table->timestamps();
                $table->unique(['course_id', 'question_id']);
            });
        }

        if (! $schema->hasTable('lms_exam_templates')) {
            $schema->create('lms_exam_templates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_id')->constrained('lms_exams')->cascadeOnDelete();
                $table->foreignId('course_id')->nullable()->constrained('lms_courses')->nullOnDelete();
                $table->string('name');
                $table->string('slug');
                $table->text('description')->nullable();
                $table->unsignedInteger('total_questions')->default(0);
                $table->unsignedInteger('duration_minutes')->default(60);
                $table->unsignedInteger('independent_count')->default(0);
                $table->unsignedInteger('case_based_count')->default(0);
                $table->json('topic_mix_json')->nullable();
                $table->json('difficulty_mix_json')->nullable();
                $table->json('competency_mix_json')->nullable();
                $table->json('section_mix_json')->nullable();
                $table->json('fixed_question_version_ids_json')->nullable();
                $table->string('selection_mode')->default('random_pool');
                $table->boolean('randomize_questions')->default(true);
                $table->boolean('randomize_options')->default(true);
                $table->boolean('allow_navigation')->default(true);
                $table->boolean('allow_review')->default(true);
                $table->boolean('allow_answer_review_after_submit')->default(true);
                $table->boolean('group_case_questions')->default(false);
                $table->boolean('allow_fallback_mix')->default(false);
                $table->unsignedTinyInteger('pass_threshold_percent')->default(70);
                $table->unsignedInteger('max_attempts')->nullable();
                $table->string('content_language')->nullable();
                $table->string('status')->default('draft');
                $table->unsignedInteger('version_number')->default(1);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('lms_exam_attempts')) {
            $schema->create('lms_exam_attempts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->foreignId('exam_template_id')->constrained('lms_exam_templates')->cascadeOnDelete();
                $table->unsignedInteger('exam_template_version')->default(1);
                $table->timestamp('started_at');
                $table->timestamp('expires_at');
                $table->timestamp('submitted_at')->nullable();
                $table->unsignedInteger('duration_seconds')->nullable();
                $table->string('status')->default('in_progress');
                $table->string('submission_reason')->nullable();
                $table->unsignedTinyInteger('score_percent')->nullable();
                $table->unsignedInteger('unanswered_count')->nullable();
                $table->json('topic_scores_json')->nullable();
                $table->json('competency_scores_json')->nullable();
                $table->json('question_set_json');
                $table->timestamps();
                $table->index(['user_id', 'exam_template_id', 'status']);
            });
        }

        if (! $schema->hasTable('lms_exam_attempt_answers')) {
            $schema->create('lms_exam_attempt_answers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('attempt_id')->constrained('lms_exam_attempts')->cascadeOnDelete();
                $table->foreignId('question_id')->constrained('lms_exam_questions')->cascadeOnDelete();
                $table->foreignId('question_version_id')->constrained('lms_exam_question_versions')->cascadeOnDelete();
                $table->unsignedBigInteger('selected_option_id')->nullable();
                $table->boolean('is_correct')->nullable();
                $table->unsignedInteger('time_spent_seconds')->nullable();
                $table->boolean('flagged')->default(false);
                $table->timestamp('answered_at')->nullable();
                $table->timestamps();
                $table->unique(['attempt_id', 'question_id']);
            });
        }

        if (! $schema->hasTable('lms_ai_generation_jobs')) {
            $schema->create('lms_ai_generation_jobs', function (Blueprint $table) {
                $table->id();
                $table->string('type');
                $table->string('status')->default('queued');
                $table->unsignedBigInteger('requested_by');
                $table->unsignedBigInteger('exam_id')->nullable();
                $table->unsignedBigInteger('evidence_pack_id')->nullable();
                $table->unsignedBigInteger('course_id')->nullable();
                $table->string('generation_profile')->nullable();
                $table->string('product_domain')->default('client_lms');
                $table->string('content_language')->default('en');
                $table->string('title')->nullable();
                $table->text('goal')->nullable();
                $table->json('request_json')->nullable();
                $table->json('blueprint_json')->nullable();
                $table->boolean('blueprint_approved')->default(false);
                $table->json('progress_json')->nullable();
                $table->json('coverage_json')->nullable();
                $table->json('manus_research_json')->nullable();
                $table->json('openai_verification_json')->nullable();
                $table->string('research_provider')->nullable();
                $table->string('generation_provider')->nullable();
                $table->text('error')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }

        $this->addColumn($schema, 'lms_courses', 'exam_id', fn (Blueprint $table) => $table->unsignedBigInteger('exam_id')->nullable());
        $this->addColumn($schema, 'lms_courses', 'subtitle', fn (Blueprint $table) => $table->string('subtitle')->nullable());
        $this->addColumn($schema, 'lms_courses', 'price_cents', fn (Blueprint $table) => $table->unsignedInteger('price_cents')->nullable());
        $this->addColumn($schema, 'lms_courses', 'currency', fn (Blueprint $table) => $table->string('currency', 8)->default('CAD'));
        $this->addColumn($schema, 'lms_courses', 'access_months', fn (Blueprint $table) => $table->unsignedInteger('access_months')->nullable());
        $this->addColumn($schema, 'lms_courses', 'access_mode', fn (Blueprint $table) => $table->string('access_mode')->default('consultant_assigned'));
        $this->addColumn($schema, 'lms_courses', 'commerce_confirmed', fn (Blueprint $table) => $table->boolean('commerce_confirmed')->default(false));
        $this->addColumn($schema, 'lms_courses', 'content_language', fn (Blueprint $table) => $table->string('content_language')->default('en'));
        $this->addColumn($schema, 'lms_courses', 'review_status', fn (Blueprint $table) => $table->string('review_status')->default('draft'));
        $this->addColumn($schema, 'lms_courses', 'is_preview', fn (Blueprint $table) => $table->boolean('is_preview')->default(false));
        $this->addColumn($schema, 'lms_courses', 'featured', fn (Blueprint $table) => $table->boolean('featured')->default(false));
        $this->addColumn($schema, 'lms_courses', 'variant_of_course_id', fn (Blueprint $table) => $table->unsignedBigInteger('variant_of_course_id')->nullable());

        $this->addColumn($schema, 'lms_course_assignments', 'source', fn (Blueprint $table) => $table->string('source')->default('consultant_assigned'));
        $this->addColumn($schema, 'lms_course_assignments', 'ends_at', fn (Blueprint $table) => $table->timestamp('ends_at')->nullable());
        $this->addColumn($schema, 'lms_lessons', 'evidence_mapping_json', fn (Blueprint $table) => $table->json('evidence_mapping_json')->nullable());
    }

    public function down(): void
    {
        // Additive — never drop on product db_lms.
    }

    private function addColumn($schema, string $table, string $column, callable $definition): void
    {
        if (! $schema->hasTable($table) || $schema->hasColumn($table, $column)) {
            return;
        }

        $schema->table($table, $definition);
    }
};
