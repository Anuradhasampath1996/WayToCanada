<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\Lms\LmsCourseAssignment;
use App\Models\Lms\LmsLesson;
use App\Models\Lms\LmsLessonCompletion;
use App\Models\Lms\LmsHomework;
use App\Models\Lms\LmsHomeworkSubmission;
use App\Models\Lms\LmsQuiz;
use App\Models\Lms\LmsQuizAttempt;
use App\Services\LmsExamService;
use App\Services\LmsProgressService;
use App\Services\LmsPathwayGate;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\Notifications\WorkspaceNotificationTriggers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientLmsController extends Controller
{
    public function __construct(
        private LmsProgressService $progress,
        private LmsExamService $exams,
        private WorkspaceNotificationTriggers $notify,
        private ClientActivityTriggers $activity,
    ) {}

    public function myCourses(Request $request): JsonResponse
    {
        $this->assertLmsUnlocked($request);
        $userId = $request->user()->id;

        $items = LmsCourseAssignment::with(['course.category'])
            ->where('client_user_id', $userId)
            ->orderByDesc('assigned_at')
            ->get()
            ->map(fn ($a) => [
                'assignment_id'    => $a->id,
                'progress_percent' => $a->progress_percent,
                'status'           => $a->status,
                'course'           => [
                    'id'            => $a->course->id,
                    'title'         => $a->course->title,
                    'description'   => $a->course->description,
                    'thumbnail_url' => $a->course->thumbnail_url,
                    'category'      => $a->course->category?->name,
                ],
            ]);

        return response()->json(['data' => $items]);
    }

    public function showAssignment(Request $request, LmsCourseAssignment $assignment): JsonResponse
    {
        $this->authorizeAssignment($request, $assignment);
        $assignment->load('course');
        return response()->json($this->progress->coursePayload($assignment->course, $assignment));
    }

    public function completeLesson(Request $request, LmsCourseAssignment $assignment, LmsLesson $lesson): JsonResponse
    {
        $this->authorizeAssignment($request, $assignment);

        LmsLessonCompletion::firstOrCreate([
            'assignment_id' => $assignment->id,
            'lesson_id'     => $lesson->id,
        ], ['completed_at' => now()]);

        $before     = $assignment->status;
        $assignment = $this->progress->recalculate($assignment);

        if ($before !== 'completed' && $assignment->status === 'completed') {
            $this->notify->onLmsCourseCompleted($assignment);
            $this->activity->onLmsCompleted($assignment);
        }

        return response()->json([
            'progress_percent' => $assignment->progress_percent,
            'status'           => $assignment->status,
        ]);
    }

    public function showQuiz(Request $request, LmsCourseAssignment $assignment, LmsQuiz $quiz): JsonResponse
    {
        $this->authorizeAssignment($request, $assignment);
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
        $this->authorizeAssignment($request, $assignment);
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

    public function showExamAttempt(Request $request, LmsCourseAssignment $assignment, LmsQuizAttempt $attempt): JsonResponse
    {
        $this->authorizeAssignment($request, $assignment);
        if ($attempt->assignment_id !== $assignment->id) {
            abort(403);
        }
        $attempt->load('quiz');

        return response()->json($this->exams->attemptResultPayload($attempt));
    }

    public function submitHomework(Request $request, LmsCourseAssignment $assignment, LmsHomework $homework): JsonResponse
    {
        $this->authorizeAssignment($request, $assignment);
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

    private function authorizeAssignment(Request $request, LmsCourseAssignment $assignment): void
    {
        if ($assignment->client_user_id !== $request->user()->id) {
            abort(403, 'Unauthorized');
        }
        $this->assertLmsUnlocked($request);
    }

    private function assertLmsUnlocked(Request $request): void
    {
        $profile = $request->user()->clientProfile;
        if (! $profile) {
            abort(403, 'Client profile not found.');
        }
        LmsPathwayGate::assertForProfile($profile);
    }
}
