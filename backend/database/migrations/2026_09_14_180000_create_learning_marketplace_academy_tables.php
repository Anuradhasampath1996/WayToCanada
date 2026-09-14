<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection('academy');

        if (! $schema->hasTable('academy_exams')) {
            $schema->create('academy_exams', function (Blueprint $table) {
                $table->id();
                $table->string('product_domain')->default('rcic_academy');
                $table->string('audience')->default('rcic');
                $table->string('key')->unique();
                $table->string('slug')->unique();
                $table->string('generation_profile')->default('rcic_exam_prep');
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

        if (! $schema->hasTable('academy_exam_translations')) {
            $schema->create('academy_exam_translations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_id')->constrained('academy_exams')->cascadeOnDelete();
                $table->string('locale', 8);
                $table->string('name');
                $table->text('description')->nullable();
                $table->timestamps();
                $table->unique(['exam_id', 'locale']);
            });
        }

        if (! $schema->hasTable('academy_exam_field_audits')) {
            $schema->create('academy_exam_field_audits', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_id')->constrained('academy_exams')->cascadeOnDelete();
                $table->unsignedBigInteger('actor_user_id');
                $table->string('field');
                $table->text('previous_value')->nullable();
                $table->text('new_value')->nullable();
                $table->text('reason')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('academy_exam_evidence_packs')) {
            $schema->create('academy_exam_evidence_packs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_id')->constrained('academy_exams')->cascadeOnDelete();
                $table->string('product_domain')->default('rcic_academy');
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

        if (! $schema->hasTable('academy_exam_evidence_items')) {
            $schema->create('academy_exam_evidence_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('pack_id')->constrained('academy_exam_evidence_packs')->cascadeOnDelete();
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

        if (! $schema->hasTable('academy_exam_generation_overrides')) {
            $schema->create('academy_exam_generation_overrides', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_id')->constrained('academy_exams')->cascadeOnDelete();
                $table->unsignedBigInteger('actor_user_id');
                $table->string('warning_code');
                $table->text('reason');
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('academy_course_questions')) {
            $schema->create('academy_course_questions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('course_id')->constrained('academy_courses')->cascadeOnDelete();
                $table->foreignId('question_id')->constrained('academy_questions')->cascadeOnDelete();
                $table->boolean('practice_eligible')->default(true);
                $table->boolean('mock_eligible')->default(true);
                $table->timestamps();
                $table->unique(['course_id', 'question_id']);
            });
        }

        if (! $schema->hasTable('academy_course_translations')) {
            $schema->create('academy_course_translations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('course_id')->constrained('academy_courses')->cascadeOnDelete();
                $table->string('locale', 8);
                $table->string('title');
                $table->string('subtitle')->nullable();
                $table->text('description')->nullable();
                $table->json('outcomes_json')->nullable();
                $table->string('translation_status')->default('draft');
                $table->boolean('translation_outdated')->default(false);
                $table->timestamps();
                $table->unique(['course_id', 'locale']);
            });
        }

        $this->addColumn($schema, 'academy_courses', 'exam_id', fn (Blueprint $table) => $table->unsignedBigInteger('exam_id')->nullable()->after('track_id'));
        $this->addColumn($schema, 'academy_courses', 'subtitle', fn (Blueprint $table) => $table->string('subtitle')->nullable());
        $this->addColumn($schema, 'academy_courses', 'price_cents', fn (Blueprint $table) => $table->unsignedInteger('price_cents')->nullable());
        $this->addColumn($schema, 'academy_courses', 'currency', fn (Blueprint $table) => $table->string('currency', 8)->default('CAD'));
        $this->addColumn($schema, 'academy_courses', 'access_months', fn (Blueprint $table) => $table->unsignedInteger('access_months')->nullable());
        $this->addColumn($schema, 'academy_courses', 'commerce_confirmed', fn (Blueprint $table) => $table->boolean('commerce_confirmed')->default(false));
        $this->addColumn($schema, 'academy_courses', 'content_language', fn (Blueprint $table) => $table->string('content_language')->default('en'));
        $this->addColumn($schema, 'academy_courses', 'is_preview', fn (Blueprint $table) => $table->boolean('is_preview')->default(false));
        $this->addColumn($schema, 'academy_courses', 'featured', fn (Blueprint $table) => $table->boolean('featured')->default(false));
        $this->addColumn($schema, 'academy_courses', 'variant_of_course_id', fn (Blueprint $table) => $table->unsignedBigInteger('variant_of_course_id')->nullable());
        $this->addColumn($schema, 'academy_courses', 'suggested_price_cents', fn (Blueprint $table) => $table->unsignedInteger('suggested_price_cents')->nullable());

        $this->addColumn($schema, 'academy_questions', 'exam_id', fn (Blueprint $table) => $table->unsignedBigInteger('exam_id')->nullable());
        $this->addColumn($schema, 'academy_questions', 'generation_job_id', fn (Blueprint $table) => $table->unsignedBigInteger('generation_job_id')->nullable());
        $this->addColumn($schema, 'academy_questions', 'generation_profile', fn (Blueprint $table) => $table->string('generation_profile')->nullable());
        $this->addColumn($schema, 'academy_questions', 'style_pattern_category', fn (Blueprint $table) => $table->string('style_pattern_category')->nullable());
        $this->addColumn($schema, 'academy_questions', 'practice_eligible', fn (Blueprint $table) => $table->boolean('practice_eligible')->default(true));
        $this->addColumn($schema, 'academy_questions', 'mock_eligible', fn (Blueprint $table) => $table->boolean('mock_eligible')->default(true));
        $this->addColumn($schema, 'academy_questions', 'content_language', fn (Blueprint $table) => $table->string('content_language')->default('en'));

        $this->addColumn($schema, 'academy_question_versions', 'provenance_json', fn (Blueprint $table) => $table->json('provenance_json')->nullable());
        $this->addColumn($schema, 'academy_question_versions', 'evidence_item_ids_json', fn (Blueprint $table) => $table->json('evidence_item_ids_json')->nullable());
        $this->addColumn($schema, 'academy_question_versions', 'validation_flags_json', fn (Blueprint $table) => $table->json('validation_flags_json')->nullable());

        $this->addColumn($schema, 'academy_lessons', 'evidence_mapping_json', fn (Blueprint $table) => $table->json('evidence_mapping_json')->nullable());
        $this->addColumn($schema, 'academy_modules', 'evidence_mapping_json', fn (Blueprint $table) => $table->json('evidence_mapping_json')->nullable());

        $this->addColumn($schema, 'academy_exam_templates', 'exam_id', fn (Blueprint $table) => $table->unsignedBigInteger('exam_id')->nullable());
        $this->addColumn($schema, 'academy_exam_templates', 'course_id', fn (Blueprint $table) => $table->unsignedBigInteger('course_id')->nullable());
        $this->addColumn($schema, 'academy_exam_templates', 'selection_mode', fn (Blueprint $table) => $table->string('selection_mode')->default('random_pool'));
        $this->addColumn($schema, 'academy_exam_templates', 'fixed_question_version_ids_json', fn (Blueprint $table) => $table->json('fixed_question_version_ids_json')->nullable());
        $this->addColumn($schema, 'academy_exam_templates', 'competency_mix_json', fn (Blueprint $table) => $table->json('competency_mix_json')->nullable());
        $this->addColumn($schema, 'academy_exam_templates', 'section_mix_json', fn (Blueprint $table) => $table->json('section_mix_json')->nullable());
        $this->addColumn($schema, 'academy_exam_templates', 'group_case_questions', fn (Blueprint $table) => $table->boolean('group_case_questions')->default(true));
        $this->addColumn($schema, 'academy_exam_templates', 'allow_answer_review_after_submit', fn (Blueprint $table) => $table->boolean('allow_answer_review_after_submit')->nullable());
        $this->addColumn($schema, 'academy_exam_templates', 'allow_fallback_mix', fn (Blueprint $table) => $table->boolean('allow_fallback_mix')->default(false));
        $this->addColumn($schema, 'academy_exam_templates', 'content_language', fn (Blueprint $table) => $table->string('content_language')->nullable());

        $this->addColumn($schema, 'academy_exam_attempts', 'submission_reason', fn (Blueprint $table) => $table->string('submission_reason')->nullable());
        $this->addColumn($schema, 'academy_exam_attempts', 'unanswered_count', fn (Blueprint $table) => $table->unsignedInteger('unanswered_count')->nullable());

        $this->addColumn($schema, 'academy_ai_generation_jobs', 'exam_id', fn (Blueprint $table) => $table->unsignedBigInteger('exam_id')->nullable());
        $this->addColumn($schema, 'academy_ai_generation_jobs', 'evidence_pack_id', fn (Blueprint $table) => $table->unsignedBigInteger('evidence_pack_id')->nullable());
        $this->addColumn($schema, 'academy_ai_generation_jobs', 'generation_profile', fn (Blueprint $table) => $table->string('generation_profile')->nullable());
        $this->addColumn($schema, 'academy_ai_generation_jobs', 'product_domain', fn (Blueprint $table) => $table->string('product_domain')->default('rcic_academy'));
        $this->addColumn($schema, 'academy_ai_generation_jobs', 'content_language', fn (Blueprint $table) => $table->string('content_language')->default('en'));
        $this->addColumn($schema, 'academy_ai_generation_jobs', 'coverage_json', fn (Blueprint $table) => $table->json('coverage_json')->nullable());

        $this->addColumn($schema, 'academy_ai_validation_results', 'exam_relevance_ok', fn (Blueprint $table) => $table->boolean('exam_relevance_ok')->nullable());
        $this->addColumn($schema, 'academy_ai_validation_results', 'style_ok', fn (Blueprint $table) => $table->boolean('style_ok')->nullable());
        $this->addColumn($schema, 'academy_ai_validation_results', 'near_copy_ok', fn (Blueprint $table) => $table->boolean('near_copy_ok')->nullable());
    }

    public function down(): void
    {
        // Additive marketplace schema — do not drop on product databases.
    }

    private function addColumn($schema, string $table, string $column, callable $definition): void
    {
        if (! $schema->hasTable($table) || $schema->hasColumn($table, $column)) {
            return;
        }

        $schema->table($table, $definition);
    }
};
