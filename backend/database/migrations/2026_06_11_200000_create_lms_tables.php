<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('lms')->create('lms_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::connection('lms')->create('lms_courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('lms_categories')->cascadeOnDelete();
            $table->string('title');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->string('thumbnail_url')->nullable();
            $table->boolean('is_published')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['category_id', 'slug']);
        });

        Schema::connection('lms')->create('lms_modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('lms_courses')->cascadeOnDelete();
            $table->string('title');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::connection('lms')->create('lms_lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('module_id')->constrained('lms_modules')->cascadeOnDelete();
            $table->string('title');
            $table->string('lesson_type', 20)->default('text'); // video, text, pdf, mixed
            $table->text('video_url')->nullable();
            $table->text('pdf_url')->nullable();
            $table->longText('text_content')->nullable();
            $table->unsignedSmallInteger('duration_minutes')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::connection('lms')->create('lms_quizzes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('lms_courses')->cascadeOnDelete();
            $table->foreignId('module_id')->nullable()->constrained('lms_modules')->nullOnDelete();
            $table->string('title');
            $table->unsignedTinyInteger('passing_score')->default(70);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::connection('lms')->create('lms_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained('lms_quizzes')->cascadeOnDelete();
            $table->text('question_text');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::connection('lms')->create('lms_question_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_id')->constrained('lms_questions')->cascadeOnDelete();
            $table->text('option_text');
            $table->boolean('is_correct')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::connection('lms')->create('lms_course_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('lms_courses')->cascadeOnDelete();
            $table->unsignedBigInteger('client_user_id');
            $table->unsignedBigInteger('assigned_by_user_id');
            $table->unsignedTinyInteger('progress_percent')->default(0);
            $table->string('status', 20)->default('assigned'); // assigned, in_progress, completed
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['course_id', 'client_user_id']);
        });

        Schema::connection('lms')->create('lms_lesson_completions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained('lms_course_assignments')->cascadeOnDelete();
            $table->foreignId('lesson_id')->constrained('lms_lessons')->cascadeOnDelete();
            $table->timestamp('completed_at')->useCurrent();
            $table->unique(['assignment_id', 'lesson_id']);
        });

        Schema::connection('lms')->create('lms_quiz_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained('lms_course_assignments')->cascadeOnDelete();
            $table->foreignId('quiz_id')->constrained('lms_quizzes')->cascadeOnDelete();
            $table->unsignedTinyInteger('score_percent');
            $table->boolean('passed')->default(false);
            $table->json('answers_json')->nullable();
            $table->timestamp('attempted_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::connection('lms')->dropIfExists('lms_quiz_attempts');
        Schema::connection('lms')->dropIfExists('lms_lesson_completions');
        Schema::connection('lms')->dropIfExists('lms_course_assignments');
        Schema::connection('lms')->dropIfExists('lms_question_options');
        Schema::connection('lms')->dropIfExists('lms_questions');
        Schema::connection('lms')->dropIfExists('lms_quizzes');
        Schema::connection('lms')->dropIfExists('lms_lessons');
        Schema::connection('lms')->dropIfExists('lms_modules');
        Schema::connection('lms')->dropIfExists('lms_courses');
        Schema::connection('lms')->dropIfExists('lms_categories');
    }
};
