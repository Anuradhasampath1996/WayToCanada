<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CourseFactory\CfCaseBank;
use App\Models\CourseFactory\CfContentValidation;
use App\Models\CourseFactory\CfExamBlueprint;
use App\Models\CourseFactory\CfGenerationEvent;
use App\Models\CourseFactory\CfGenerationRun;
use App\Models\CourseFactory\CfGenerationStep;
use App\Models\CourseFactory\CfMockExamBlueprint;
use App\Models\CourseFactory\CfResearchSource;
use App\Models\CourseFactory\CfUsageRecord;
use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsHomework;
use App\Models\Lms\LmsLesson;
use App\Models\Lms\LmsModule;
use App\Models\Lms\LmsQuestionBank;
use App\Models\Lms\LmsQuestionBankOption;
use App\Models\Lms\LmsQuiz;
use App\Models\Lms\LmsQuizBankQuestion;
use App\Services\CourseFactory\Pipeline\CourseFactoryOrchestrator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class AdminCourseFactoryController extends Controller
{
    public function __construct(private CourseFactoryOrchestrator $orchestrator) {}

    public function index(Request $request): JsonResponse
    {
        $runs = CfGenerationRun::query()
            ->orderByDesc('id')
            ->limit(50)
            ->get([
                'id', 'exam_name', 'canonical_exam_name', 'status', 'overall_progress',
                'current_step', 'course_id', 'started_at', 'completed_at', 'created_at',
            ]);

        $courses = LmsCourse::query()
            ->whereIn('id', $runs->pluck('course_id')->filter()->unique()->values())
            ->get(['id', 'price_cents', 'currency', 'access_months', 'commerce_confirmed', 'title'])
            ->keyBy('id');

        $data = $runs->map(function (CfGenerationRun $run) use ($courses) {
            $course = $run->course_id ? $courses->get($run->course_id) : null;

            return [
                ...$run->toArray(),
                'course_title' => $course?->title,
                'price_cents' => $course?->price_cents,
                'currency' => $course?->currency ?? 'CAD',
                'access_months' => $course?->access_months,
                'commerce_confirmed' => (bool) ($course?->commerce_confirmed ?? false),
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'exam_name' => ['required', 'string', 'max:255'],
            'options' => ['sometimes', 'array'],
        ]);

        $run = $this->orchestrator->start(
            (int) $request->user()->id,
            $data['exam_name'],
            $data['options'] ?? []
        );

        $payload = $run->load('steps')->toArray();
        unset($payload['config_snapshot']['openai']['key'], $payload['config_snapshot']['manus']['api_key']);

        return response()->json([
            'data' => $payload,
            'redirect' => '/admindashboard/ai-course-factory/'.$run->id,
        ], 201);
    }

    public function show(CfGenerationRun $run): JsonResponse
    {
        $run->load(['steps', 'blueprint', 'mockBlueprint']);

        $events = CfGenerationEvent::query()
            ->where('generation_run_id', $run->id)
            ->orderByDesc('id')
            ->limit(80)
            ->get();

        $stats = [
            'modules' => LmsModule::query()->where('course_id', $run->course_id)->count(),
            'lessons' => LmsLesson::query()->whereHas('module', fn ($q) => $q->where('course_id', $run->course_id))->count(),
            'lessons_ready' => LmsLesson::query()->whereHas('module', fn ($q) => $q->where('course_id', $run->course_id))->get()
                ->filter(fn ($l) => ($l->ai_metadata_json['status'] ?? '') === 'content_ready')->count(),
            'practice_questions' => LmsQuestionBank::query()->where('course_id', $run->course_id)->whereNotNull('lesson_id')->count(),
            'question_bank' => LmsQuestionBank::query()->where('course_id', $run->course_id)->count(),
            'verified_questions' => LmsQuestionBank::query()->where('course_id', $run->course_id)->where('verification_status', 'ai_verified')->count(),
            'quizzes' => LmsQuiz::query()->where('course_id', $run->course_id)->count(),
            'assignments' => LmsHomework::query()->where('course_id', $run->course_id)->count(),
            'sources' => $run->sources()->count(),
            'question_bank_target' => (int) (($run->stats_json['question_bank_target'] ?? 0)),
            'mock_ready' => (bool) $run->mockBlueprint,
        ];

        $modules = LmsModule::query()
            ->where('course_id', $run->course_id)
            ->with(['lessons' => fn ($q) => $q->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get();

        $usage = CfUsageRecord::query()
            ->where('generation_run_id', $run->id)
            ->get()
            ->groupBy('provider')
            ->map(fn ($rows) => [
                'requests' => $rows->sum('request_count'),
                'input_tokens' => $rows->sum('input_tokens'),
                'output_tokens' => $rows->sum('output_tokens'),
                'images' => $rows->sum('image_generations'),
                'manus_tasks' => $rows->sum('manus_task_count'),
            ]);

        return response()->json([
            'data' => [
                'run' => $this->publicRun($run),
                'events' => $events,
                'stats' => $stats,
                'modules' => $modules,
                'sources' => $run->sources()->orderByDesc('authority_tier')->orderBy('id')->get(),
                'usage' => $usage,
                'course' => $run->course_id ? LmsCourse::query()->find($run->course_id) : null,
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function publicRun(CfGenerationRun $run): array
    {
        $payload = $run->toArray();
        if (isset($payload['config_snapshot']) && is_array($payload['config_snapshot'])) {
            unset($payload['config_snapshot']['openai']['key'], $payload['config_snapshot']['manus']['api_key']);
        }

        return $payload;
    }

    public function events(Request $request, CfGenerationRun $run): JsonResponse
    {
        $after = (int) $request->query('after', 0);
        $events = CfGenerationEvent::query()
            ->where('generation_run_id', $run->id)
            ->when($after > 0, fn ($q) => $q->where('id', '>', $after))
            ->orderBy('id')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => $events,
            'run' => $run->only(['id', 'status', 'overall_progress', 'current_step', 'error_summary']),
            'steps' => $run->steps()->orderBy('sequence')->get(),
        ]);
    }

    public function cancel(CfGenerationRun $run): JsonResponse
    {
        $this->orchestrator->cancel($run);

        return response()->json(['data' => $run->fresh('steps')]);
    }

    public function resume(CfGenerationRun $run): JsonResponse
    {
        $this->orchestrator->resume($run->fresh('steps'));

        return response()->json(['data' => $run->fresh('steps')]);
    }

    public function retryStep(Request $request, CfGenerationRun $run): JsonResponse
    {
        $data = $request->validate(['step_key' => ['required', 'string']]);
        $this->orchestrator->retryStep($run->fresh('steps'), $data['step_key']);

        return response()->json(['data' => $run->fresh('steps')]);
    }

    public function publish(Request $request, CfGenerationRun $run): JsonResponse
    {
        if ($run->status !== 'pending_review') {
            return response()->json(['message' => 'Course must be pending admin review before publish.'], 422);
        }

        $course = LmsCourse::query()->findOrFail($run->course_id);
        $course->update([
            'is_published' => true,
            'review_status' => 'published',
        ]);
        $run->update(['status' => 'published']);

        return response()->json(['data' => ['run' => $run->fresh(), 'course' => $course->fresh()]]);
    }

    public function update(Request $request, CfGenerationRun $run): JsonResponse
    {
        $data = $request->validate([
            'exam_name' => ['sometimes', 'string', 'max:255'],
            'canonical_exam_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'course_title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'course_description' => ['sometimes', 'nullable', 'string'],
            'is_published' => ['sometimes', 'boolean'],
            'price_cad' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'price_cents' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'access_months' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:60'],
            'commerce_confirmed' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('exam_name', $data)) {
            $run->exam_name = $data['exam_name'];
        }
        if (array_key_exists('canonical_exam_name', $data)) {
            $run->canonical_exam_name = $data['canonical_exam_name'];
        }
        $run->save();

        if ($run->course_id) {
            $course = LmsCourse::query()->find($run->course_id);
            if ($course) {
                $coursePatch = [
                    'currency' => 'CAD',
                ];
                if (! empty($data['course_title'])) {
                    $coursePatch['title'] = $data['course_title'];
                } elseif (! empty($data['canonical_exam_name']) || ! empty($data['exam_name'])) {
                    $coursePatch['title'] = $data['canonical_exam_name'] ?? $data['exam_name'];
                }
                if (array_key_exists('course_description', $data)) {
                    $coursePatch['description'] = $data['course_description'];
                }
                if (array_key_exists('is_published', $data)) {
                    $coursePatch['is_published'] = (bool) $data['is_published'];
                    $coursePatch['review_status'] = $data['is_published'] ? 'published' : ($course->review_status ?: 'pending_review');
                    if ($data['is_published']) {
                        $run->update(['status' => 'published']);
                    } elseif ($run->status === 'published') {
                        $run->update(['status' => 'pending_review']);
                    }
                }
                if (array_key_exists('price_cents', $data)) {
                    $coursePatch['price_cents'] = $data['price_cents'];
                } elseif (array_key_exists('price_cad', $data)) {
                    $coursePatch['price_cents'] = $data['price_cad'] === null
                        ? null
                        : (int) round(((float) $data['price_cad']) * 100);
                }
                if (array_key_exists('access_months', $data)) {
                    $coursePatch['access_months'] = $data['access_months'];
                }
                if (array_key_exists('commerce_confirmed', $data)) {
                    $coursePatch['commerce_confirmed'] = (bool) $data['commerce_confirmed'];
                } elseif (array_key_exists('price_cents', $coursePatch) && $coursePatch['price_cents'] !== null && $coursePatch['price_cents'] > 0) {
                    $coursePatch['commerce_confirmed'] = true;
                    $coursePatch['access_mode'] = $course->access_mode ?: 'assigned_or_purchase';
                }
                $course->update($coursePatch);
            }
        }

        $course = $run->course_id ? LmsCourse::query()->find($run->course_id) : null;

        return response()->json([
            'data' => [
                'run' => $run->fresh(),
                'course' => $course,
            ],
        ]);
    }

    public function destroy(CfGenerationRun $run): JsonResponse
    {
        $courseId = $run->course_id;

        DB::connection('lms')->transaction(function () use ($run, $courseId) {
            CfGenerationEvent::query()->where('generation_run_id', $run->id)->delete();
            CfGenerationStep::query()->where('generation_run_id', $run->id)->delete();
            CfResearchSource::query()->where('generation_run_id', $run->id)->delete();
            CfExamBlueprint::query()->where('generation_run_id', $run->id)->delete();
            CfMockExamBlueprint::query()->where('generation_run_id', $run->id)->delete();
            CfCaseBank::query()->where('generation_run_id', $run->id)->delete();
            CfContentValidation::query()->where('generation_run_id', $run->id)->delete();
            CfUsageRecord::query()->where('generation_run_id', $run->id)->delete();

            if ($courseId) {
                $moduleIds = LmsModule::query()->where('course_id', $courseId)->pluck('id');
                LmsLesson::query()->whereIn('module_id', $moduleIds)->delete();
                LmsModule::query()->where('course_id', $courseId)->delete();

                $quizIds = LmsQuiz::query()->where('course_id', $courseId)->pluck('id');
                LmsQuizBankQuestion::query()->whereIn('quiz_id', $quizIds)->delete();
                LmsQuiz::query()->where('course_id', $courseId)->delete();

                $bankIds = LmsQuestionBank::query()->where('course_id', $courseId)->pluck('id');
                LmsQuestionBankOption::query()->whereIn('bank_question_id', $bankIds)->delete();
                LmsQuestionBank::query()->where('course_id', $courseId)->delete();

                LmsHomework::query()->where('course_id', $courseId)->delete();

                $course = LmsCourse::query()->find($courseId);
                if ($course?->thumbnail_url) {
                    $oldPath = str_replace(
                        rtrim((string) config('app.url'), '/').'/storage/',
                        '',
                        $course->thumbnail_url
                    );
                    if ($oldPath && ! str_starts_with($oldPath, 'http')) {
                        Storage::disk('public')->delete($oldPath);
                    }
                }
                $course?->delete();
            }

            $run->delete();
        });

        return response()->json(['message' => 'Generation run and related course deleted.']);
    }

    public function settings(): JsonResponse
    {
        return response()->json([
            'data' => [
                'openai_configured' => filled(config('course_factory.openai.key') ?: config('services.openai.key')),
                'manus_configured' => filled(config('course_factory.manus.api_key')),
                'openai_text_model' => config('course_factory.openai.text_model'),
                'openai_reasoning_model' => config('course_factory.openai.reasoning_model'),
                'openai_image_model' => config('course_factory.openai.image_model'),
                'question_bank' => config('course_factory.question_bank'),
                'difficulty_distribution' => config('course_factory.difficulty_distribution'),
                'max_retries' => config('course_factory.max_retries'),
            ],
        ]);
    }
}
