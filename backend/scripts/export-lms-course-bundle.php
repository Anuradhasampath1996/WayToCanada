<?php

/**
 * Export one LMS course (and Course Factory run data) as JSON for production import.
 *
 * Usage:
 *   php backend/scripts/export-lms-course-bundle.php 9
 *   php backend/scripts/export-lms-course-bundle.php --slug=rcic-entry-to-practice-exam
 */
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\CourseFactory\CfCaseBank;
use App\Models\CourseFactory\CfContentValidation;
use App\Models\CourseFactory\CfExamBlueprint;
use App\Models\CourseFactory\CfGenerationEvent;
use App\Models\CourseFactory\CfGenerationRun;
use App\Models\CourseFactory\CfGenerationStep;
use App\Models\CourseFactory\CfMockExamBlueprint;
use App\Models\CourseFactory\CfResearchSource;
use App\Models\CourseFactory\CfUsageRecord;
use App\Models\Lms\LmsCategory;
use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsHomework;
use App\Models\Lms\LmsLesson;
use App\Models\Lms\LmsModule;
use App\Models\Lms\LmsQuestionBank;
use App\Models\Lms\LmsQuestionBankOption;
use App\Models\Lms\LmsQuestion;
use App\Models\Lms\LmsQuestionOption;
use App\Models\Lms\LmsQuiz;
use App\Models\Lms\LmsQuizBankQuestion;

$arg = $argv[1] ?? null;
if (! $arg) {
    fwrite(STDERR, "Usage: php export-lms-course-bundle.php <course_id>|--slug=<slug>\n");
    exit(1);
}

$courseQuery = LmsCourse::query();
if (str_starts_with($arg, '--slug=')) {
    $courseQuery->where('slug', substr($arg, 7));
} else {
    $courseQuery->where('id', (int) $arg);
}

$course = $courseQuery->first();
if (! $course) {
    fwrite(STDERR, "Course not found.\n");
    exit(1);
}

$category = $course->category_id ? LmsCategory::query()->find($course->category_id) : null;
$modules = LmsModule::query()->where('course_id', $course->id)->orderBy('sort_order')->orderBy('id')->get();
$moduleIds = $modules->pluck('id');
$lessons = LmsLesson::query()->whereIn('module_id', $moduleIds)->orderBy('sort_order')->orderBy('id')->get();

$banks = LmsQuestionBank::query()->where('course_id', $course->id)->orderBy('sort_order')->orderBy('id')->get();
$bankIds = $banks->pluck('id');
$bankOptions = LmsQuestionBankOption::query()->whereIn('bank_question_id', $bankIds)->orderBy('sort_order')->orderBy('id')->get();

$quizzes = LmsQuiz::query()->where('course_id', $course->id)->orderBy('sort_order')->orderBy('id')->get();
$quizIds = $quizzes->pluck('id');
$quizBankLinks = LmsQuizBankQuestion::query()->whereIn('quiz_id', $quizIds)->orderBy('id')->get();
$quizQuestions = LmsQuestion::query()->whereIn('quiz_id', $quizIds)->orderBy('sort_order')->orderBy('id')->get();
$quizQuestionIds = $quizQuestions->pluck('id');
$quizOptions = $quizQuestionIds->isNotEmpty()
    ? LmsQuestionOption::query()->whereIn('question_id', $quizQuestionIds)->orderBy('sort_order')->orderBy('id')->get()
    : collect();

$homework = LmsHomework::query()->where('course_id', $course->id)->orderBy('sort_order')->orderBy('id')->get();

$runId = $course->cf_generation_run_id;
$run = $runId ? CfGenerationRun::query()->find($runId) : null;

$bundle = [
    'exported_at' => now()->toIso8601String(),
    'source_course_id' => $course->id,
    'category' => $category?->toArray(),
    'course' => $course->toArray(),
    'modules' => $modules->toArray(),
    'lessons' => $lessons->toArray(),
    'question_bank' => $banks->toArray(),
    'question_bank_options' => $bankOptions->toArray(),
    'quizzes' => $quizzes->toArray(),
    'quiz_bank_links' => $quizBankLinks->toArray(),
    'quiz_questions' => $quizQuestions->toArray(),
    'quiz_question_options' => $quizOptions->toArray(),
    'homework' => $homework->toArray(),
    'cf_run' => $run?->toArray(),
    'cf_steps' => $run ? CfGenerationStep::query()->where('generation_run_id', $run->id)->orderBy('sequence')->get()->toArray() : [],
    'cf_events' => $run ? CfGenerationEvent::query()->where('generation_run_id', $run->id)->orderBy('id')->limit(200)->get()->toArray() : [],
    'cf_sources' => $run ? CfResearchSource::query()->where('generation_run_id', $run->id)->orderBy('id')->get()->toArray() : [],
    'cf_blueprint' => $run ? CfExamBlueprint::query()->where('generation_run_id', $run->id)->first()?->toArray() : null,
    'cf_mock_blueprint' => $run ? CfMockExamBlueprint::query()->where('generation_run_id', $run->id)->first()?->toArray() : null,
    'cf_case_bank' => $run ? CfCaseBank::query()->where('generation_run_id', $run->id)->get()->toArray() : [],
    'cf_validations' => $run ? CfContentValidation::query()->where('generation_run_id', $run->id)->get()->toArray() : [],
    'cf_usage' => $run ? CfUsageRecord::query()->where('generation_run_id', $run->id)->get()->toArray() : [],
];

// Strip secrets from config snapshot if present.
if (isset($bundle['cf_run']['config_snapshot']) && is_array($bundle['cf_run']['config_snapshot'])) {
    unset(
        $bundle['cf_run']['config_snapshot']['openai']['key'],
        $bundle['cf_run']['config_snapshot']['manus']['api_key']
    );
}

$outDir = __DIR__.'/../../deploy/course-bundles';
if (! is_dir($outDir)) {
    mkdir($outDir, 0775, true);
}

$slug = $course->slug ?: ('course-'.$course->id);
$path = $outDir.'/'.$slug.'.json';
file_put_contents($path, json_encode($bundle, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

echo "Exported {$course->title} → {$path}\n";
echo 'modules='.count($bundle['modules']).' lessons='.count($bundle['lessons']).' bank='.count($bundle['question_bank']).' quizzes='.count($bundle['quizzes'])."\n";
