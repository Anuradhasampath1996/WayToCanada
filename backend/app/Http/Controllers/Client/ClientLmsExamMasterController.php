<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsExamAttempt;
use App\Models\Lms\LmsExamTemplate;
use App\Services\Lms\LmsExamMasterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientLmsExamMasterController extends Controller
{
    public function __construct(private LmsExamMasterService $sittings) {}

    public function templates(Request $request, LmsCourse $course): JsonResponse
    {
        $this->sittings->assertCourseAccess($request->user(), $course);
        $rows = LmsExamTemplate::query()
            ->where('course_id', $course->id)
            ->where('status', 'published')
            ->orderBy('name')
            ->get(['id', 'name', 'duration_minutes', 'total_questions', 'selection_mode', 'independent_count', 'case_based_count']);

        return response()->json(['data' => $rows]);
    }

    public function start(Request $request, LmsExamTemplate $template): JsonResponse
    {
        $attempt = $this->sittings->start($request->user(), $template);

        return response()->json($this->sittings->show($request->user(), $attempt), 201);
    }

    public function show(Request $request, LmsExamAttempt $attempt): JsonResponse
    {
        return response()->json($this->sittings->show($request->user(), $attempt));
    }

    public function saveAnswer(Request $request, LmsExamAttempt $attempt): JsonResponse
    {
        $data = $request->validate([
            'question_id' => 'required|integer',
            'selected_option_id' => 'nullable|integer',
            'flagged' => 'nullable|boolean',
            'time_spent_seconds' => 'nullable|integer',
        ]);
        $this->sittings->saveAnswer($request->user(), $attempt, $data);

        return response()->json($this->sittings->show($request->user(), $attempt->fresh()));
    }

    public function submit(Request $request, LmsExamAttempt $attempt): JsonResponse
    {
        return response()->json($this->sittings->submit($request->user(), $attempt));
    }

    public function results(Request $request, LmsExamAttempt $attempt): JsonResponse
    {
        return response()->json($this->sittings->show($request->user(), $attempt));
    }
}
