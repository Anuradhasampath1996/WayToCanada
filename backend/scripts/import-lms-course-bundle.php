<?php

/**
 * Import an LMS course JSON bundle (idempotent by course slug).
 *
 * Usage (inside API container):
 *   php /var/www/scripts/import-lms-course-bundle.php /var/www/../deploy/course-bundles/rcic-entry-to-practice-exam.json
 *   php backend/scripts/import-lms-course-bundle.php deploy/course-bundles/<slug>.json
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
use App\Models\Lms\LmsQuestion;
use App\Models\Lms\LmsQuestionBank;
use App\Models\Lms\LmsQuestionBankOption;
use App\Models\Lms\LmsQuestionOption;
use App\Models\Lms\LmsQuiz;
use App\Models\Lms\LmsQuizBankQuestion;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

$path = $argv[1] ?? null;
if (! $path || ! is_file($path)) {
    fwrite(STDERR, "Usage: php import-lms-course-bundle.php <bundle.json>\n");
    exit(1);
}

$bundle = json_decode(file_get_contents($path), true);
if (! is_array($bundle) || empty($bundle['course']['slug'])) {
    fwrite(STDERR, "Invalid bundle JSON\n");
    exit(1);
}

function stripIds(array $row, array $extra = []): array
{
    unset($row['id'], $row['created_at'], $row['updated_at']);
    foreach ($extra as $key) {
        unset($row[$key]);
    }

    return $row;
}

function onlyFillable(string $modelClass, array $row): array
{
    /** @var \Illuminate\Database\Eloquent\Model $model */
    $model = new $modelClass;
    $fillable = $model->getFillable();
    if ($fillable === []) {
        return $row;
    }

    return array_intersect_key($row, array_flip($fillable));
}

DB::connection('lms')->transaction(function () use ($bundle) {
    $categoryId = null;
    if (! empty($bundle['category']['slug'])) {
        $category = LmsCategory::query()->updateOrCreate(
            ['slug' => $bundle['category']['slug']],
            onlyFillable(LmsCategory::class, stripIds($bundle['category']))
        );
        $categoryId = $category->id;
    }

    $courseData = onlyFillable(LmsCourse::class, stripIds($bundle['course'], ['category_id', 'cf_generation_run_id', 'exam_id', 'variant_of_course_id', 'generation_job_id']));
    $courseData['category_id'] = $categoryId;
    $courseData['cf_generation_run_id'] = null;
    $courseData['audience'] = $courseData['audience'] ?? 'consultant';
    $courseData['is_published'] = (bool) ($bundle['course']['is_published'] ?? true);

    $course = LmsCourse::query()->updateOrCreate(
        ['slug' => $bundle['course']['slug']],
        $courseData
    );

    // Replace content graph for this course (keep course row + assignments/attempts on live if any).
    $oldModuleIds = LmsModule::query()->where('course_id', $course->id)->pluck('id');
    if ($oldModuleIds->isNotEmpty()) {
        LmsLesson::query()->whereIn('module_id', $oldModuleIds)->delete();
    }
    LmsModule::query()->where('course_id', $course->id)->delete();

    $oldQuizIds = LmsQuiz::query()->where('course_id', $course->id)->pluck('id');
    if ($oldQuizIds->isNotEmpty()) {
        LmsQuizBankQuestion::query()->whereIn('quiz_id', $oldQuizIds)->delete();
        $qIds = LmsQuestion::query()->whereIn('quiz_id', $oldQuizIds)->pluck('id');
        if ($qIds->isNotEmpty()) {
            LmsQuestionOption::query()->whereIn('question_id', $qIds)->delete();
        }
        LmsQuestion::query()->whereIn('quiz_id', $oldQuizIds)->delete();
    }
    LmsQuiz::query()->where('course_id', $course->id)->delete();

    $oldBankIds = LmsQuestionBank::query()->where('course_id', $course->id)->pluck('id');
    if ($oldBankIds->isNotEmpty()) {
        LmsQuestionBankOption::query()->whereIn('bank_question_id', $oldBankIds)->delete();
    }
    LmsQuestionBank::query()->where('course_id', $course->id)->delete();
    LmsHomework::query()->where('course_id', $course->id)->delete();

    $moduleMap = []; // old_id => new_id
    foreach ($bundle['modules'] ?? [] as $mod) {
        $oldId = $mod['id'];
        $created = LmsModule::query()->create(array_merge(
            onlyFillable(LmsModule::class, stripIds($mod, ['course_id'])),
            ['course_id' => $course->id]
        ));
        $moduleMap[$oldId] = $created->id;
    }

    $lessonMap = [];
    foreach ($bundle['lessons'] ?? [] as $lesson) {
        $oldModuleId = $lesson['module_id'] ?? null;
        if (! isset($moduleMap[$oldModuleId])) {
            continue;
        }
        $created = LmsLesson::query()->create(array_merge(
            onlyFillable(LmsLesson::class, stripIds($lesson, ['module_id'])),
            ['module_id' => $moduleMap[$oldModuleId]]
        ));
        $lessonMap[$lesson['id']] = $created->id;
    }

    $bankMap = [];
    foreach ($bundle['question_bank'] ?? [] as $q) {
        $payload = onlyFillable(LmsQuestionBank::class, stripIds($q, ['course_id', 'module_id', 'lesson_id', 'generation_run_id']));
        $payload['course_id'] = $course->id;
        if (! empty($q['module_id']) && isset($moduleMap[$q['module_id']])) {
            $payload['module_id'] = $moduleMap[$q['module_id']];
        } else {
            $payload['module_id'] = null;
        }
        if (! empty($q['lesson_id']) && isset($lessonMap[$q['lesson_id']])) {
            $payload['lesson_id'] = $lessonMap[$q['lesson_id']];
        } else {
            $payload['lesson_id'] = null;
        }
        $payload['generation_run_id'] = null;
        $created = LmsQuestionBank::query()->create($payload);
        $bankMap[$q['id']] = $created->id;
    }

    foreach ($bundle['question_bank_options'] ?? [] as $opt) {
        $oldBankId = $opt['bank_question_id'] ?? null;
        if (! isset($bankMap[$oldBankId])) {
            continue;
        }
        LmsQuestionBankOption::query()->create(array_merge(
            onlyFillable(LmsQuestionBankOption::class, stripIds($opt, ['bank_question_id'])),
            ['bank_question_id' => $bankMap[$oldBankId]]
        ));
    }

    $quizMap = [];
    foreach ($bundle['quizzes'] ?? [] as $quiz) {
        $payload = onlyFillable(LmsQuiz::class, stripIds($quiz, ['course_id', 'module_id']));
        $payload['course_id'] = $course->id;
        if (! empty($quiz['module_id']) && isset($moduleMap[$quiz['module_id']])) {
            $payload['module_id'] = $moduleMap[$quiz['module_id']];
        } else {
            $payload['module_id'] = null;
        }
        $created = LmsQuiz::query()->create($payload);
        $quizMap[$quiz['id']] = $created->id;
    }

    foreach ($bundle['quiz_bank_links'] ?? [] as $link) {
        if (! isset($quizMap[$link['quiz_id'] ?? null], $bankMap[$link['bank_question_id'] ?? null])) {
            continue;
        }
        LmsQuizBankQuestion::query()->firstOrCreate(
            [
                'quiz_id' => $quizMap[$link['quiz_id']],
                'bank_question_id' => $bankMap[$link['bank_question_id']],
            ],
            ['sort_order' => $link['sort_order'] ?? 0]
        );
    }

    $questionMap = [];
    foreach ($bundle['quiz_questions'] ?? [] as $qq) {
        if (! isset($quizMap[$qq['quiz_id'] ?? null])) {
            continue;
        }
        $created = LmsQuestion::query()->create(array_merge(
            onlyFillable(LmsQuestion::class, stripIds($qq, ['quiz_id'])),
            ['quiz_id' => $quizMap[$qq['quiz_id']]]
        ));
        $questionMap[$qq['id']] = $created->id;
    }

    foreach ($bundle['quiz_question_options'] ?? [] as $opt) {
        if (! isset($questionMap[$opt['question_id'] ?? null])) {
            continue;
        }
        LmsQuestionOption::query()->create(array_merge(
            onlyFillable(LmsQuestionOption::class, stripIds($opt, ['question_id'])),
            ['question_id' => $questionMap[$opt['question_id']]]
        ));
    }

    foreach ($bundle['homework'] ?? [] as $hw) {
        $payload = onlyFillable(LmsHomework::class, stripIds($hw, ['course_id', 'module_id']));
        $payload['course_id'] = $course->id;
        if (! empty($hw['module_id']) && isset($moduleMap[$hw['module_id']])) {
            $payload['module_id'] = $moduleMap[$hw['module_id']];
        } else {
            $payload['module_id'] = null;
        }
        LmsHomework::query()->create($payload);
    }

    $runId = null;
    if (! empty($bundle['cf_run']) && Schema::connection('lms')->hasTable('cf_generation_runs')) {
        $runPayload = onlyFillable(CfGenerationRun::class, stripIds($bundle['cf_run'], ['course_id', 'admin_user_id']));
        $runPayload['course_id'] = $course->id;
        $runPayload['admin_user_id'] = $bundle['cf_run']['admin_user_id'] ?? null;
        $runPayload['status'] = $runPayload['status'] ?? 'completed';

        // Prefer reuse by exam name + course.
        $run = CfGenerationRun::query()
            ->where('course_id', $course->id)
            ->where('canonical_exam_name', $runPayload['canonical_exam_name'] ?? ($runPayload['exam_name'] ?? ''))
            ->orderByDesc('id')
            ->first();

        if ($run) {
            $run->fill($runPayload)->save();
        } else {
            $run = CfGenerationRun::query()->create($runPayload);
        }
        $runId = $run->id;

        CfGenerationStep::query()->where('generation_run_id', $runId)->delete();
        foreach ($bundle['cf_steps'] ?? [] as $step) {
            CfGenerationStep::query()->create(array_merge(
                onlyFillable(CfGenerationStep::class, stripIds($step, ['generation_run_id'])),
                ['generation_run_id' => $runId]
            ));
        }

        CfGenerationEvent::query()->where('generation_run_id', $runId)->delete();
        foreach ($bundle['cf_events'] ?? [] as $event) {
            CfGenerationEvent::query()->create(array_merge(
                onlyFillable(CfGenerationEvent::class, stripIds($event, ['generation_run_id'])),
                ['generation_run_id' => $runId]
            ));
        }

        CfResearchSource::query()->where('generation_run_id', $runId)->delete();
        foreach ($bundle['cf_sources'] ?? [] as $src) {
            CfResearchSource::query()->create(array_merge(
                onlyFillable(CfResearchSource::class, stripIds($src, ['generation_run_id'])),
                ['generation_run_id' => $runId]
            ));
        }

        if (! empty($bundle['cf_blueprint'])) {
            CfExamBlueprint::query()->updateOrCreate(
                ['generation_run_id' => $runId],
                onlyFillable(CfExamBlueprint::class, stripIds($bundle['cf_blueprint'], ['generation_run_id']))
            );
        }
        if (! empty($bundle['cf_mock_blueprint'])) {
            CfMockExamBlueprint::query()->updateOrCreate(
                ['generation_run_id' => $runId],
                onlyFillable(CfMockExamBlueprint::class, stripIds($bundle['cf_mock_blueprint'], ['generation_run_id']))
            );
        }

        CfCaseBank::query()->where('generation_run_id', $runId)->delete();
        foreach ($bundle['cf_case_bank'] ?? [] as $row) {
            CfCaseBank::query()->create(array_merge(
                onlyFillable(CfCaseBank::class, stripIds($row, ['generation_run_id'])),
                ['generation_run_id' => $runId]
            ));
        }

        CfContentValidation::query()->where('generation_run_id', $runId)->delete();
        foreach ($bundle['cf_validations'] ?? [] as $row) {
            CfContentValidation::query()->create(array_merge(
                onlyFillable(CfContentValidation::class, stripIds($row, ['generation_run_id'])),
                ['generation_run_id' => $runId]
            ));
        }

        CfUsageRecord::query()->where('generation_run_id', $runId)->delete();
        foreach ($bundle['cf_usage'] ?? [] as $row) {
            CfUsageRecord::query()->create(array_merge(
                onlyFillable(CfUsageRecord::class, stripIds($row, ['generation_run_id'])),
                ['generation_run_id' => $runId]
            ));
        }

        $course->update(['cf_generation_run_id' => $runId]);
    }

    echo "Imported course id={$course->id} slug={$course->slug} modules=".count($moduleMap).' lessons='.count($lessonMap).' bank='.count($bankMap).' quizzes='.count($quizMap)." cf_run=".($runId ?? 'none')."\n";
});
