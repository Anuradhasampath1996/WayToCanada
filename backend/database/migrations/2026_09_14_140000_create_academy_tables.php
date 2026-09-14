<?php

use App\Services\Academy\AcademyBootstrap;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('academy')->hasTable('academy_learning_tracks')) {
            app(AcademyBootstrap::class)->ensure();

            return;
        }

        Schema::connection('academy')->create('academy_learning_tracks', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_topics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('track_id')->nullable()->constrained('academy_learning_tracks')->nullOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('academy_topics')->nullOnDelete();
            $table->string('key')->unique();
            $table->string('name');
            $table->string('division')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_competencies', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_legal_sources', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('source_organization')->nullable();
            $table->string('source_url', 1000)->nullable();
            $table->string('source_type')->default('statute');
            $table->string('citation_label')->nullable();
            $table->date('effective_date')->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->string('version_label')->nullable();
            $table->string('status')->default('draft');
            $table->text('summary')->nullable();
            $table->json('key_points_json')->nullable();
            $table->unsignedBigInteger('legislation_document_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('track_id')->nullable()->constrained('academy_learning_tracks')->nullOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('thumbnail_url', 1000)->nullable();
            $table->string('category')->nullable();
            $table->string('difficulty')->default('intermediate');
            $table->decimal('estimated_hours', 6, 1)->nullable();
            $table->string('access_tier')->default('subscription');
            $table->string('status')->default('draft');
            $table->unsignedBigInteger('current_published_version_id')->nullable();
            $table->timestamp('last_reviewed_at')->nullable();
            $table->unsignedBigInteger('legal_reviewer_user_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_course_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('academy_courses')->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('estimated_hours', 6, 1)->nullable();
            $table->string('status')->default('draft');
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->text('change_notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->unsignedBigInteger('published_by')->nullable();
            $table->timestamps();
            $table->unique(['course_id', 'version_number']);
        });

        Schema::connection('academy')->create('academy_modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_version_id')->constrained('academy_course_versions')->cascadeOnDelete();
            $table->string('title');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('module_id')->constrained('academy_modules')->cascadeOnDelete();
            $table->string('title');
            $table->string('lesson_type')->default('rich_text');
            $table->longText('body_html')->nullable();
            $table->string('media_url', 1000)->nullable();
            $table->string('media_disk')->nullable();
            $table->unsignedInteger('duration_minutes')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->json('quiz_spec_json')->nullable();
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_lesson_topics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_id')->constrained('academy_lessons')->cascadeOnDelete();
            $table->foreignId('topic_id')->constrained('academy_topics')->cascadeOnDelete();
            $table->unique(['lesson_id', 'topic_id']);
        });

        Schema::connection('academy')->create('academy_lesson_competencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_id')->constrained('academy_lessons')->cascadeOnDelete();
            $table->foreignId('competency_id')->constrained('academy_competencies')->cascadeOnDelete();
            $table->unique(['lesson_id', 'competency_id']);
        });

        Schema::connection('academy')->create('academy_cases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('track_id')->nullable()->constrained('academy_learning_tracks')->nullOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('status')->default('draft');
            $table->unsignedBigInteger('current_published_version_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_case_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_id')->constrained('academy_cases')->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->json('client_profile_json')->nullable();
            $table->text('immigration_history')->nullable();
            $table->longText('facts')->nullable();
            $table->text('procedural_history')->nullable();
            $table->text('tribunal_info')->nullable();
            $table->json('legal_issues_json')->nullable();
            $table->string('status')->default('draft');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->unsignedBigInteger('published_by')->nullable();
            $table->timestamps();
            $table->unique(['case_id', 'version_number']);
        });

        Schema::connection('academy')->create('academy_case_exhibits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_version_id')->constrained('academy_case_versions')->cascadeOnDelete();
            $table->string('title');
            $table->string('exhibit_type')->nullable();
            $table->longText('body_html')->nullable();
            $table->string('file_url', 1000)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_questions', function (Blueprint $table) {
            $table->id();
            $table->string('type');
            $table->string('status')->default('draft');
            $table->unsignedBigInteger('current_published_version_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_question_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_id')->constrained('academy_questions')->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->longText('question_text');
            $table->longText('explanation')->nullable();
            $table->string('difficulty')->default('medium');
            $table->foreignId('case_version_id')->nullable()->constrained('academy_case_versions')->nullOnDelete();
            $table->string('status')->default('draft');
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->boolean('needs_legal_review')->default(false);
            $table->boolean('source_outdated')->default(false);
            $table->boolean('source_changed')->default(false);
            $table->unsignedBigInteger('author_user_id')->nullable();
            $table->unsignedBigInteger('reviewer_user_id')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->unique(['question_id', 'version_number']);
        });

        Schema::connection('academy')->create('academy_question_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_version_id')->constrained('academy_question_versions')->cascadeOnDelete();
            $table->string('option_key', 8);
            $table->text('option_text');
            $table->boolean('is_correct')->default(false);
            $table->text('incorrect_explanation')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_question_topics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_version_id')->constrained('academy_question_versions')->cascadeOnDelete();
            $table->foreignId('topic_id')->constrained('academy_topics')->cascadeOnDelete();
            $table->unique(['question_version_id', 'topic_id']);
        });

        Schema::connection('academy')->create('academy_question_competencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_version_id')->constrained('academy_question_versions')->cascadeOnDelete();
            $table->foreignId('competency_id')->constrained('academy_competencies')->cascadeOnDelete();
            $table->unique(['question_version_id', 'competency_id']);
        });

        Schema::connection('academy')->create('academy_case_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_version_id')->constrained('academy_case_versions')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('academy_questions')->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->unique(['case_version_id', 'question_id']);
        });

        Schema::connection('academy')->create('academy_exam_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('track_id')->nullable()->constrained('academy_learning_tracks')->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->unsignedInteger('total_questions');
            $table->unsignedInteger('duration_minutes');
            $table->unsignedInteger('independent_count')->default(0);
            $table->unsignedInteger('case_based_count')->default(0);
            $table->json('topic_mix_json')->nullable();
            $table->json('difficulty_mix_json')->nullable();
            $table->boolean('randomize_questions')->default(true);
            $table->boolean('randomize_options')->default(false);
            $table->boolean('allow_navigation')->default(true);
            $table->boolean('allow_review')->default(true);
            $table->unsignedTinyInteger('pass_threshold_percent')->default(70);
            $table->unsignedTinyInteger('readiness_threshold_percent')->default(70);
            $table->unsignedInteger('max_attempts')->nullable();
            $table->string('status')->default('draft');
            $table->unsignedInteger('version_number')->default(1);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_exam_attempts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreignId('exam_template_id')->constrained('academy_exam_templates')->cascadeOnDelete();
            $table->unsignedInteger('exam_template_version')->default(1);
            $table->timestamp('started_at');
            $table->timestamp('expires_at');
            $table->timestamp('submitted_at')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->string('status')->default('in_progress');
            $table->unsignedTinyInteger('score_percent')->nullable();
            $table->unsignedTinyInteger('independent_score_percent')->nullable();
            $table->unsignedTinyInteger('case_score_percent')->nullable();
            $table->json('topic_scores_json')->nullable();
            $table->json('competency_scores_json')->nullable();
            $table->json('time_analysis_json')->nullable();
            $table->unsignedTinyInteger('readiness_score')->nullable();
            $table->json('question_set_json');
            $table->timestamps();
            $table->index(['user_id', 'exam_template_id', 'status']);
        });

        Schema::connection('academy')->create('academy_exam_attempt_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attempt_id')->constrained('academy_exam_attempts')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('academy_questions')->cascadeOnDelete();
            $table->foreignId('question_version_id')->constrained('academy_question_versions')->cascadeOnDelete();
            $table->unsignedBigInteger('selected_option_id')->nullable();
            $table->boolean('is_correct')->nullable();
            $table->unsignedInteger('time_spent_seconds')->nullable();
            $table->boolean('flagged')->default(false);
            $table->timestamp('answered_at')->nullable();
            $table->timestamps();
            $table->unique(['attempt_id', 'question_id']);
        });

        Schema::connection('academy')->create('academy_practice_sessions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->json('filters_json')->nullable();
            $table->unsignedInteger('question_count');
            $table->string('explain_mode')->default('explain_immediately');
            $table->string('status')->default('in_progress');
            $table->json('question_set_json');
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });

        Schema::connection('academy')->create('academy_question_attempts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreignId('question_id')->constrained('academy_questions')->cascadeOnDelete();
            $table->foreignId('question_version_id')->constrained('academy_question_versions')->cascadeOnDelete();
            $table->unsignedBigInteger('selected_option_id')->nullable();
            $table->boolean('is_correct')->nullable();
            $table->unsignedInteger('time_spent_seconds')->nullable();
            $table->string('mode');
            $table->unsignedBigInteger('exam_attempt_id')->nullable();
            $table->unsignedBigInteger('practice_session_id')->nullable();
            $table->string('confidence')->nullable();
            $table->timestamp('attempted_at');
            $table->timestamps();
            $table->index(['user_id', 'mode']);
        });

        Schema::connection('academy')->create('academy_learning_progress', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreignId('course_id')->constrained('academy_courses')->cascadeOnDelete();
            $table->foreignId('course_version_id')->constrained('academy_course_versions')->cascadeOnDelete();
            $table->string('status')->default('in_progress');
            $table->decimal('completion_percent', 5, 2)->default(0);
            $table->unsignedBigInteger('last_lesson_id')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'course_id']);
        });

        Schema::connection('academy')->create('academy_lesson_completions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreignId('lesson_id')->constrained('academy_lessons')->cascadeOnDelete();
            $table->foreignId('course_version_id')->constrained('academy_course_versions')->cascadeOnDelete();
            $table->timestamp('completed_at');
            $table->unique(['user_id', 'lesson_id', 'course_version_id']);
        });

        Schema::connection('academy')->create('academy_bookmarks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('bookmarkable_type');
            $table->unsignedBigInteger('bookmarkable_id');
            $table->timestamps();
            $table->unique(['user_id', 'bookmarkable_type', 'bookmarkable_id'], 'academy_bookmarks_unique');
        });

        Schema::connection('academy')->create('academy_notes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('notable_type');
            $table->unsignedBigInteger('notable_id');
            $table->text('body');
            $table->timestamps();
            $table->index(['user_id', 'notable_type', 'notable_id']);
        });

        Schema::connection('academy')->create('academy_question_reports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreignId('question_id')->constrained('academy_questions')->cascadeOnDelete();
            $table->foreignId('question_version_id')->constrained('academy_question_versions')->cascadeOnDelete();
            $table->string('reason');
            $table->text('comment')->nullable();
            $table->string('status')->default('open');
            $table->text('admin_notes')->nullable();
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_study_plans', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreignId('track_id')->nullable()->constrained('academy_learning_tracks')->nullOnDelete();
            $table->foreignId('exam_template_id')->nullable()->constrained('academy_exam_templates')->nullOnDelete();
            $table->date('exam_date')->nullable();
            $table->unsignedInteger('weekly_hours')->nullable();
            $table->json('preferred_days_json')->nullable();
            $table->json('generated_weeks_json')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
            $table->index('user_id');
        });

        Schema::connection('academy')->create('academy_study_plan_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained('academy_study_plans')->cascadeOnDelete();
            $table->unsignedInteger('week_number');
            $table->foreignId('topic_id')->nullable()->constrained('academy_topics')->nullOnDelete();
            $table->string('title');
            $table->unsignedInteger('planned_minutes')->default(0);
            $table->unsignedInteger('completed_minutes')->default(0);
            $table->date('due_on')->nullable();
            $table->string('status')->default('planned');
            $table->timestamps();
        });

        Schema::connection('academy')->create('academy_entitlements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('type');
            $table->foreignId('course_id')->nullable()->constrained('academy_courses')->nullOnDelete();
            $table->foreignId('track_id')->nullable()->constrained('academy_learning_tracks')->nullOnDelete();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'is_active']);
        });

        Schema::connection('academy')->create('academy_content_source_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('legal_source_id')->constrained('academy_legal_sources')->cascadeOnDelete();
            $table->string('linkable_type');
            $table->unsignedBigInteger('linkable_id');
            $table->string('section_label')->nullable();
            $table->timestamps();
            $table->unique(['legal_source_id', 'linkable_type', 'linkable_id', 'section_label'], 'academy_source_links_unique');
        });

        Schema::connection('academy')->create('academy_content_reviews', function (Blueprint $table) {
            $table->id();
            $table->string('reviewable_type');
            $table->unsignedBigInteger('reviewable_id');
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->unsignedBigInteger('actor_user_id')->nullable();
            $table->text('comment')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['reviewable_type', 'reviewable_id']);
        });

        Schema::connection('academy')->create('academy_outdated_flags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('legal_source_id')->nullable()->constrained('academy_legal_sources')->nullOnDelete();
            $table->string('linkable_type');
            $table->unsignedBigInteger('linkable_id');
            $table->string('reason')->nullable();
            $table->string('status')->default('pending');
            $table->timestamp('flagged_at');
            $table->timestamp('resolved_at')->nullable();
            $table->unsignedBigInteger('resolved_by')->nullable();
            $table->timestamps();
        });

        app(AcademyBootstrap::class)->ensure();
    }

    public function down(): void
    {
        Schema::connection('academy')->dropIfExists('academy_outdated_flags');
        Schema::connection('academy')->dropIfExists('academy_content_reviews');
        Schema::connection('academy')->dropIfExists('academy_content_source_links');
        Schema::connection('academy')->dropIfExists('academy_entitlements');
        Schema::connection('academy')->dropIfExists('academy_study_plan_items');
        Schema::connection('academy')->dropIfExists('academy_study_plans');
        Schema::connection('academy')->dropIfExists('academy_question_reports');
        Schema::connection('academy')->dropIfExists('academy_notes');
        Schema::connection('academy')->dropIfExists('academy_bookmarks');
        Schema::connection('academy')->dropIfExists('academy_lesson_completions');
        Schema::connection('academy')->dropIfExists('academy_learning_progress');
        Schema::connection('academy')->dropIfExists('academy_question_attempts');
        Schema::connection('academy')->dropIfExists('academy_practice_sessions');
        Schema::connection('academy')->dropIfExists('academy_exam_attempt_answers');
        Schema::connection('academy')->dropIfExists('academy_exam_attempts');
        Schema::connection('academy')->dropIfExists('academy_exam_templates');
        Schema::connection('academy')->dropIfExists('academy_case_questions');
        Schema::connection('academy')->dropIfExists('academy_question_competencies');
        Schema::connection('academy')->dropIfExists('academy_question_topics');
        Schema::connection('academy')->dropIfExists('academy_question_options');
        Schema::connection('academy')->dropIfExists('academy_question_versions');
        Schema::connection('academy')->dropIfExists('academy_questions');
        Schema::connection('academy')->dropIfExists('academy_case_exhibits');
        Schema::connection('academy')->dropIfExists('academy_case_versions');
        Schema::connection('academy')->dropIfExists('academy_cases');
        Schema::connection('academy')->dropIfExists('academy_lesson_competencies');
        Schema::connection('academy')->dropIfExists('academy_lesson_topics');
        Schema::connection('academy')->dropIfExists('academy_lessons');
        Schema::connection('academy')->dropIfExists('academy_modules');
        Schema::connection('academy')->dropIfExists('academy_course_versions');
        Schema::connection('academy')->dropIfExists('academy_courses');
        Schema::connection('academy')->dropIfExists('academy_legal_sources');
        Schema::connection('academy')->dropIfExists('academy_competencies');
        Schema::connection('academy')->dropIfExists('academy_topics');
        Schema::connection('academy')->dropIfExists('academy_learning_tracks');
    }
};
