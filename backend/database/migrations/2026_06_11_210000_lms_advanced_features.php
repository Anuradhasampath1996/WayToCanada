<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('lms')->create('lms_question_bank', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('lms_courses')->cascadeOnDelete();
            $table->text('question_text');
            $table->string('topic', 120)->nullable();
            $table->string('difficulty', 20)->default('medium'); // easy, medium, hard
            $table->text('explanation')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::connection('lms')->create('lms_question_bank_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_question_id')->constrained('lms_question_bank')->cascadeOnDelete();
            $table->text('option_text');
            $table->boolean('is_correct')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::connection('lms')->table('lms_quizzes', function (Blueprint $table) {
            $table->string('content_type', 20)->default('quiz')->after('title'); // quiz, exam, mock_exam
            $table->string('source_mode', 20)->default('inline')->after('content_type'); // inline, bank_fixed, bank_random
            $table->unsignedSmallInteger('random_question_count')->nullable()->after('source_mode');
            $table->unsignedSmallInteger('time_limit_minutes')->nullable()->after('random_question_count');
            $table->text('description')->nullable()->after('time_limit_minutes');
        });

        Schema::connection('lms')->create('lms_quiz_bank_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained('lms_quizzes')->cascadeOnDelete();
            $table->foreignId('bank_question_id')->constrained('lms_question_bank')->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->unique(['quiz_id', 'bank_question_id']);
        });

        Schema::connection('lms')->create('lms_homework', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('lms_courses')->cascadeOnDelete();
            $table->foreignId('module_id')->nullable()->constrained('lms_modules')->nullOnDelete();
            $table->string('title');
            $table->longText('instructions')->nullable();
            $table->unsignedSmallInteger('max_score')->default(100);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::connection('lms')->create('lms_homework_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('homework_id')->constrained('lms_homework')->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained('lms_course_assignments')->cascadeOnDelete();
            $table->longText('content')->nullable();
            $table->unsignedSmallInteger('score')->nullable();
            $table->string('status', 20)->default('submitted'); // submitted, reviewed
            $table->text('feedback')->nullable();
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamps();
            $table->unique(['homework_id', 'assignment_id']);
        });

        Schema::connection('lms')->table('lms_quiz_attempts', function (Blueprint $table) {
            $table->json('questions_snapshot_json')->nullable()->after('answers_json');
            $table->unsignedInteger('time_taken_seconds')->nullable()->after('questions_snapshot_json');
        });
    }

    public function down(): void
    {
        Schema::connection('lms')->table('lms_quiz_attempts', function (Blueprint $table) {
            $table->dropColumn(['questions_snapshot_json', 'time_taken_seconds']);
        });
        Schema::connection('lms')->dropIfExists('lms_homework_submissions');
        Schema::connection('lms')->dropIfExists('lms_homework');
        Schema::connection('lms')->dropIfExists('lms_quiz_bank_questions');
        Schema::connection('lms')->table('lms_quizzes', function (Blueprint $table) {
            $table->dropColumn(['content_type', 'source_mode', 'random_question_count', 'time_limit_minutes', 'description']);
        });
        Schema::connection('lms')->dropIfExists('lms_question_bank_options');
        Schema::connection('lms')->dropIfExists('lms_question_bank');
    }
};
