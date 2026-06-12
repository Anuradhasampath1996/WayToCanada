<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsCourseAssignment;
use App\Models\Lms\LmsQuizAttempt;
use App\Services\LmsProgressService;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\Notifications\WorkspaceNotificationTriggers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantLmsController extends Controller
{
    public function __construct(
        private LmsProgressService $progress,
        private WorkspaceNotificationTriggers $notify,
        private ClientActivityTriggers $activity,
    ) {}

    private function authorizeClient(Request $request, ClientProfile $profile): void
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Unauthorized');
        }
    }

    public function index(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeClient($request, $profile);

        $assignments = LmsCourseAssignment::with(['course.category', 'quizAttempts.quiz'])
            ->where('client_user_id', $profile->user_id)
            ->orderByDesc('assigned_at')
            ->get()
            ->map(fn ($a) => [
                'id'               => $a->id,
                'progress_percent' => $a->progress_percent,
                'status'           => $a->status,
                'assigned_at'      => $a->assigned_at,
                'course'           => $a->course?->only(['id', 'title', 'slug']),
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
        $courses = LmsCourse::with('category')
            ->where('is_published', true)
            ->orderBy('sort_order')
            ->get(['id', 'title', 'slug', 'category_id', 'description']);

        return response()->json(['data' => $courses]);
    }

    public function assign(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeClient($request, $profile);

        $data = $request->validate([
            'course_id' => 'required|exists:lms.lms_courses,id',
        ]);

        $course = LmsCourse::where('id', $data['course_id'])->where('is_published', true)->firstOrFail();

        $assignment = LmsCourseAssignment::firstOrCreate(
            ['course_id' => $course->id, 'client_user_id' => $profile->user_id],
            ['assigned_by_user_id' => $request->user()->id, 'status' => 'assigned', 'assigned_at' => now()]
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
        if ($assignment->client_user_id !== $profile->user_id) {
            abort(403);
        }
        $assignment->delete();
        return response()->json(['message' => 'Unassigned']);
    }
}
