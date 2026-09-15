<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsCourseAssignment;
use App\Models\Lms\LmsHomework;
use App\Models\Lms\LmsHomeworkSubmission;
use App\Models\Lms\LmsLesson;
use App\Models\Lms\LmsLessonCompletion;
use App\Models\Lms\LmsQuiz;
use App\Models\Lms\LmsQuizAttempt;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\LmsExamService;
use App\Services\LmsPathwayGate;
use App\Services\LmsProgressService;
use App\Services\Notifications\WorkspaceNotificationTriggers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantLmsController extends Controller
{
    public function __construct(
        private LmsProgressService $progress,
        private LmsExamService $exams,
        private WorkspaceNotificationTriggers $notify,
        private ClientActivityTriggers $activity,
    ) {}

    private function authorizeClient(Request $request, ClientProfile $profile): void
    {
        app(\App\Services\Team\TeamAccess::class)->authorize($request->user(), $profile, 'lms.view');
    }

    public function index(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeClient($request, $profile);
        LmsPathwayGate::assertForProfile($profile);

        $assignments = LmsCourseAssignment::with(['course.category', 'quizAttempts.quiz'])
            ->where('client_user_id', $profile->user_id)
            ->orderByDesc('assigned_at')
            ->get()
            ->map(fn ($a) => [
                'id'               => $a->id,
                'progress_percent' => $a->progress_percent,
                'status'           => $a->status,
                'assigned_at'      => $a->assigned_at,
                'course'           => $a->course?->only(['id', 'title', 'slug', 'thumbnail_url', 'description']),
                'category'         => $a->course?->category?->only(['id', 'name']),
                'quiz_attempts'    => $a->quizAttempts->map(fn ($t) => [
                    'id'            => $t->id,
                    'quiz_title'    => $t->quiz?->title,
                    'score_percent' => $t->score_percent,
                    'passed'        => $t->passed,
                    'attempted_at'  => $t->attempted_at,
                ]),
            ]);

        return response()->json(['data' => $assignments]);
    }

    public function availableCourses(Request $request): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $owned = LmsCourseAssignment::query()
            ->where('client_user_id', $userId)
            ->where(function ($q) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->where('status', '!=', 'expired')
            ->get(['course_id', 'id', 'progress_percent', 'status'])
            ->keyBy('course_id');

        $courses = LmsCourse::query()
            ->forConsultants()
            ->with('category')
            ->withCount(['modules', 'quizzes', 'questionBank'])
            ->where('is_published', true)
            ->orderBy('sort_order')
            ->get([
                'id', 'title', 'slug', 'category_id', 'description', 'thumbnail_url',
                'subtitle', 'short_description', 'price_cents', 'currency', 'access_months',
                'estimated_hours', 'difficulty', 'regulator', 'access_mode', 'audience',
            ])
            ->map(function (LmsCourse $course) use ($owned) {
                $assignment = $owned->get($course->id);
                $payload = $course->toArray();
                $payload['owned'] = (bool) $assignment;
                $payload['assignment_id'] = $assignment?->id;
                $payload['progress_percent'] = $assignment?->progress_percent;
                $payload['learning_status'] = $assignment?->status;

                return $payload;
            });

        return response()->json(['data' => $courses]);
    }

    /** Published courses that consultants may assign to clients (not consultant exam-prep). */
    public function availableClientCourses(Request $request): JsonResponse
    {
        $courses = LmsCourse::query()
            ->forClients()
            ->with('category')
            ->withCount(['modules', 'quizzes', 'questionBank'])
            ->where('is_published', true)
            ->orderBy('sort_order')
            ->get([
                'id', 'title', 'slug', 'category_id', 'description', 'thumbnail_url',
                'subtitle', 'short_description', 'price_cents', 'currency', 'access_months',
                'estimated_hours', 'difficulty', 'regulator', 'access_mode', 'audience',
            ]);

        return response()->json(['data' => $courses]);
    }

    public function showCourse(Request $request, LmsCourse $course): JsonResponse
    {
        if (! $course->is_published || ($course->audience ?? 'client') !== 'consultant') {
            abort(404);
        }

        $course->load(['category', 'modules.lessons']);
        $course->loadCount(['modules', 'quizzes', 'questionBank', 'homework']);

        $assignment = $this->activeAssignmentFor($request->user()->id, $course->id);
        $priceCents = (int) ($course->price_cents ?? 0);
        $isFree = $priceCents < 1 || $course->access_mode === 'free';

        return response()->json([
            'data' => [
                'id' => $course->id,
                'title' => $course->title,
                'slug' => $course->slug,
                'subtitle' => $course->subtitle,
                'description' => $course->description,
                'short_description' => $course->short_description,
                'thumbnail_url' => $course->thumbnail_url,
                'price_cents' => $course->price_cents,
                'currency' => $course->currency ?? 'CAD',
                'access_months' => $course->access_months,
                'estimated_hours' => $course->estimated_hours,
                'difficulty' => $course->difficulty,
                'regulator' => $course->regulator,
                'access_mode' => $course->access_mode,
                'audience' => 'consultant',
                'category' => $course->category?->only(['id', 'name', 'slug']),
                'modules_count' => $course->modules_count,
                'quizzes_count' => $course->quizzes_count,
                'question_bank_count' => $course->question_bank_count,
                'homework_count' => $course->homework_count,
                'modules' => $course->modules->map(fn ($m) => [
                    'id' => $m->id,
                    'title' => $m->title,
                    'lessons_count' => $m->lessons->count(),
                    'lessons' => $m->lessons->map(fn ($l) => [
                        'id' => $l->id,
                        'title' => $l->title,
                        'lesson_type' => $l->lesson_type,
                    ]),
                ]),
                'access' => [
                    'owned' => (bool) $assignment,
                    'assignment_id' => $assignment?->id,
                    'progress_percent' => $assignment?->progress_percent ?? 0,
                    'status' => $assignment?->status,
                    'is_free' => $isFree,
                    'can_buy' => ! $assignment && ! $isFree && $priceCents > 0,
                    'can_start' => ! $assignment && $isFree,
                    'can_continue' => (bool) $assignment,
                ],
            ],
        ]);
    }

    public function startLearning(Request $request, LmsCourse $course): JsonResponse
    {
        if (! $course->is_published || ($course->audience ?? 'client') !== 'consultant') {
            abort(404);
        }

        $userId = (int) $request->user()->id;
        $existing = $this->activeAssignmentFor($userId, $course->id);
        if ($existing) {
            return response()->json([
                'data' => [
                    'assignment_id' => $existing->id,
                    'course_id' => $course->id,
                    'already_owned' => true,
                ],
            ]);
        }

        $priceCents = (int) ($course->price_cents ?? 0);
        $isFree = $priceCents < 1 || $course->access_mode === 'free';
        if (! $isFree) {
            return response()->json([
                'message' => 'This course requires purchase before you can start learning.',
            ], 402);
        }

        $assignment = LmsCourseAssignment::query()->create([
            'course_id' => $course->id,
            'client_user_id' => $userId,
            'assigned_by_user_id' => $userId,
            'status' => 'assigned',
            'source' => 'self_purchase',
            'assigned_at' => now(),
            'ends_at' => now()->addMonths((int) ($course->access_months ?: config('learning.default_access_months', 3))),
        ]);

        return response()->json([
            'data' => [
                'assignment_id' => $assignment->id,
                'course_id' => $course->id,
                'already_owned' => false,
            ],
        ], 201);
    }

    public function showAssignment(Request $request, LmsCourseAssignment $assignment): JsonResponse
    {
        $this->authorizeOwnAssignment($request, $assignment);
        $assignment->load('course');

        return response()->json($this->progress->coursePayload($assignment->course, $assignment));
    }

    public function completeLesson(Request $request, LmsCourseAssignment $assignment, LmsLesson $lesson): JsonResponse
    {
        $this->authorizeOwnAssignment($request, $assignment);

        LmsLessonCompletion::firstOrCreate([
            'assignment_id' => $assignment->id,
            'lesson_id'     => $lesson->id,
        ], ['completed_at' => now()]);

        $assignment = $this->progress->recalculate($assignment);

        return response()->json([
            'progress_percent' => $assignment->progress_percent,
            'status'           => $assignment->status,
        ]);
    }

    public function showQuiz(Request $request, LmsCourseAssignment $assignment, LmsQuiz $quiz): JsonResponse
    {
        $this->authorizeOwnAssignment($request, $assignment);
        if ($quiz->course_id !== $assignment->course_id) {
            abort(404);
        }

        $attemptNum = LmsQuizAttempt::where('assignment_id', $assignment->id)
            ->where('quiz_id', $quiz->id)->count();
        $seed       = $assignment->id * 10000 + $quiz->id * 100 + $attemptNum;
        $questions  = $this->exams->resolveQuestionsForQuiz($quiz, $seed);

        $payload = $this->exams->clientQuestionsPayload($questions, $quiz);
        $payload['attempt_seed'] = $seed;

        return response()->json($payload);
    }

    public function submitQuiz(Request $request, LmsCourseAssignment $assignment, LmsQuiz $quiz): JsonResponse
    {
        $this->authorizeOwnAssignment($request, $assignment);
        if ($quiz->course_id !== $assignment->course_id) {
            abort(404);
        }

        $data = $request->validate([
            'answers'             => 'required|array',
            'answers.*'           => 'integer',
            'time_taken_seconds'  => 'nullable|integer|min:0',
            'attempt_seed'        => 'nullable|integer',
        ]);

        $attemptNum = LmsQuizAttempt::where('assignment_id', $assignment->id)
            ->where('quiz_id', $quiz->id)->count();
        $seed       = $data['attempt_seed'] ?? ($assignment->id * 10000 + $quiz->id * 100 + $attemptNum);
        $questions  = $this->exams->resolveQuestionsForQuiz($quiz, $seed);
        $graded    = $this->exams->grade($quiz, $questions, $data['answers']);

        $attempt = LmsQuizAttempt::create([
            'assignment_id'           => $assignment->id,
            'quiz_id'                 => $quiz->id,
            'score_percent'           => $graded['score_percent'],
            'passed'                  => $graded['passed'],
            'answers_json'            => $data['answers'],
            'questions_snapshot_json' => $this->exams->snapshotForStorage($questions),
            'time_taken_seconds'      => $data['time_taken_seconds'] ?? null,
            'attempted_at'            => now(),
        ]);

        return response()->json([
            'attempt_id'      => $attempt->id,
            'score_percent'   => $graded['score_percent'],
            'passed'          => $graded['passed'],
            'correct'         => $graded['correct'],
            'total'           => $graded['total'],
            'breakdown'       => $graded['breakdown'],
        ]);
    }

    public function submitHomework(Request $request, LmsCourseAssignment $assignment, LmsHomework $homework): JsonResponse
    {
        $this->authorizeOwnAssignment($request, $assignment);
        if ($homework->course_id !== $assignment->course_id) {
            abort(404);
        }

        $data = $request->validate(['content' => 'required|string']);

        $sub = LmsHomeworkSubmission::updateOrCreate(
            ['homework_id' => $homework->id, 'assignment_id' => $assignment->id],
            ['content' => $data['content'], 'status' => 'submitted', 'submitted_at' => now()]
        );

        return response()->json($sub, 201);
    }

    public function assign(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeClient($request, $profile);
        LmsPathwayGate::assertForProfile($profile);

        $data = $request->validate([
            'course_id' => 'required|exists:lms.lms_courses,id',
        ]);

        $course = LmsCourse::where('id', $data['course_id'])
            ->where('is_published', true)
            ->forClients()
            ->firstOrFail();

        $assignment = LmsCourseAssignment::firstOrCreate(
            ['course_id' => $course->id, 'client_user_id' => $profile->user_id],
            ['assigned_by_user_id' => $request->user()->id, 'status' => 'assigned', 'assigned_at' => now(), 'source' => 'consultant_assigned']
        );

        if ($assignment->wasRecentlyCreated) {
            $this->notify->onCourseAssigned($profile, $assignment, $request->user());
            $this->activity->onLmsAssigned($profile, $assignment, $request->user(), $request);
        }

        return response()->json($assignment->load('course.category'), 201);
    }

    public function unassign(Request $request, ClientProfile $profile, LmsCourseAssignment $assignment): JsonResponse
    {
        $this->authorizeClient($request, $profile);
        LmsPathwayGate::assertForProfile($profile);
        if ($assignment->client_user_id !== $profile->user_id) {
            abort(403);
        }
        $assignment->delete();

        return response()->json(['message' => 'Unassigned']);
    }

    private function activeAssignmentFor(int $userId, int $courseId): ?LmsCourseAssignment
    {
        return LmsCourseAssignment::query()
            ->where('client_user_id', $userId)
            ->where('course_id', $courseId)
            ->where('status', '!=', 'expired')
            ->where(function ($q) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->first();
    }

    private function authorizeOwnAssignment(Request $request, LmsCourseAssignment $assignment): void
    {
        if ((int) $assignment->client_user_id !== (int) $request->user()->id) {
            abort(403, 'Unauthorized');
        }
        if ($assignment->status === 'expired') {
            abort(403, 'Course access has expired.');
        }
        if ($assignment->ends_at && $assignment->ends_at->isPast()) {
            abort(403, 'Course access has expired.');
        }
    }
}
