<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\Academy\AcademyBookmark;
use App\Models\Academy\AcademyCase;
use App\Models\Academy\AcademyCourse;
use App\Models\Academy\AcademyExamAttempt;
use App\Models\Academy\AcademyExamTemplate;
use App\Models\Academy\AcademyLearningTrack;
use App\Models\Academy\AcademyLegalSource;
use App\Models\Academy\AcademyLesson;
use App\Models\Academy\AcademyNote;
use App\Models\Academy\AcademyPracticeSession;
use App\Models\Academy\AcademyQuestion;
use App\Models\Academy\AcademyQuestionReport;
use App\Models\Academy\AcademyStudyPlan;
use App\Services\Academy\AcademyAccess;
use App\Services\Academy\AcademyAnalyticsService;
use App\Services\Academy\AcademyCourseService;
use App\Services\Academy\AcademyExamService;
use App\Services\Academy\AcademyNotificationService;
use App\Services\Academy\AcademyPayload;
use App\Services\Academy\AcademyPlannerService;
use App\Services\Academy\AcademyPracticeService;
use App\Services\Learning\LearningCatalogService;
use Illuminate\Http\Request;

class ConsultantAcademyController extends Controller
{
    public function __construct(
        private AcademyAccess $access,
        private AcademyCourseService $courses,
        private AcademyPracticeService $practice,
        private AcademyExamService $exams,
        private AcademyAnalyticsService $analytics,
        private AcademyPlannerService $planner,
        private AcademyPayload $payload,
        private AcademyNotificationService $notifications,
        private LearningCatalogService $catalog,
    ) {}

    public function dashboard(Request $request)
    {
        $this->access->assertAcademySurface($request->user());

        return response()->json($this->analytics->dashboard($request->user()));
    }

    public function tracks(Request $request)
    {
        $this->access->assertAcademySurface($request->user());

        return response()->json(['data' => AcademyLearningTrack::query()->orderBy('sort_order')->get()]);
    }

    public function courses(Request $request)
    {
        $this->access->assertLearner($request->user());
        $locale = $request->query('locale', $request->user()->locale ?? 'en');

        return response()->json([
            'data' => $this->catalog->academyCatalog($request->user(), $locale, $request->only([
                'q', 'exam_id', 'category', 'language', 'price', 'status',
            ])),
        ]);
    }

    public function showCourse(Request $request, AcademyCourse $course)
    {
        return response()->json($this->courses->learnerCourse($request->user(), $course));
    }

    public function completeLesson(Request $request, AcademyCourse $course, AcademyLesson $lesson)
    {
        $progress = $this->courses->completeLesson($request->user(), $course, $lesson);
        if ($progress->status === 'completed') {
            $this->notifications->courseCompleted($request->user(), $course->title);
        }

        return response()->json(['progress' => $progress]);
    }

    public function switchCourseVersion(Request $request, AcademyCourse $course)
    {
        return response()->json(['progress' => $this->courses->switchToLatest($request->user(), $course)]);
    }

    public function showLesson(Request $request, AcademyLesson $lesson)
    {
        $this->access->assertAcademySurface($request->user());

        return response()->json([
            'lesson' => $lesson->only(['id', 'title', 'lesson_type', 'body_html', 'media_url', 'duration_minutes']),
            'disclaimer' => config('academy.disclaimer'),
        ]);
    }

    public function startPractice(Request $request)
    {
        $data = $request->validate([
            'count' => 'nullable|integer|min:1|max:100',
            'type' => 'nullable|in:independent_mcq,case_mcq',
            'topic_id' => 'nullable|integer',
            'competency_id' => 'nullable|integer',
            'difficulty' => 'nullable|string',
            'division' => 'nullable|string',
            'incorrect_only' => 'nullable|boolean',
            'unanswered_only' => 'nullable|boolean',
            'explain_mode' => 'nullable|in:explain_immediately,explain_after_set',
        ]);
        $session = $this->practice->start($request->user(), $data);

        return response()->json($this->practice->show($request->user(), $session), 201);
    }

    public function showPractice(Request $request, AcademyPracticeSession $practice)
    {
        return response()->json($this->practice->show($request->user(), $practice));
    }

    public function answerPractice(Request $request, AcademyPracticeSession $practice)
    {
        $data = $request->validate([
            'question_id' => 'required|integer',
            'selected_option_id' => 'required|integer',
            'confidence' => 'nullable|in:low,medium,high',
            'time_spent_seconds' => 'nullable|integer',
        ]);

        return response()->json($this->practice->answer(
            $request->user(),
            $practice,
            (int) $data['question_id'],
            (int) $data['selected_option_id'],
            $data['confidence'] ?? null,
            $data['time_spent_seconds'] ?? null,
        ));
    }

    public function showCase(Request $request, AcademyCase $case)
    {
        $this->access->assertAcademySurface($request->user());
        if (! $case->isPublished()) {
            abort(404);
        }

        return response()->json([
            'case' => $this->payload->learnerCase($case->publishedVersion()->with('exhibits')->firstOrFail()),
            'disclaimer' => config('academy.disclaimer'),
        ]);
    }

    public function exams(Request $request)
    {
        $this->access->assertAcademySurface($request->user());

        return response()->json([
            'data' => AcademyExamTemplate::query()->where('status', 'published')->orderBy('name')->get(),
        ]);
    }

    public function startExam(Request $request, AcademyExamTemplate $template)
    {
        $attempt = $this->exams->start($request->user(), $template);

        return response()->json($this->exams->show($request->user(), $attempt), 201);
    }

    public function showExam(Request $request, AcademyExamAttempt $attempt)
    {
        return response()->json($this->exams->show($request->user(), $attempt));
    }

    public function saveExamAnswer(Request $request, AcademyExamAttempt $attempt)
    {
        $data = $request->validate([
            'question_id' => 'required|integer',
            'selected_option_id' => 'nullable|integer',
            'flagged' => 'nullable|boolean',
            'time_spent_seconds' => 'nullable|integer',
        ]);
        $this->exams->saveAnswer($request->user(), $attempt, $data);

        return response()->json($this->exams->show($request->user(), $attempt->fresh()));
    }

    public function submitExam(Request $request, AcademyExamAttempt $attempt)
    {
        return response()->json($this->exams->submit($request->user(), $attempt));
    }

    public function examResults(Request $request, AcademyExamAttempt $attempt)
    {
        return response()->json($this->exams->show($request->user(), $attempt));
    }

    public function analytics(Request $request)
    {
        $this->access->assertAcademySurface($request->user());

        return response()->json($this->analytics->learnerAnalytics($request->user()));
    }

    public function bookmarks(Request $request)
    {
        $this->access->assertAcademySurface($request->user());

        return response()->json([
            'data' => AcademyBookmark::query()->where('user_id', $request->user()->id)->latest()->get(),
        ]);
    }

    public function storeBookmark(Request $request)
    {
        $this->access->assertAcademySurface($request->user());
        $data = $request->validate([
            'bookmarkable_type' => 'required|string',
            'bookmarkable_id' => 'required|integer',
        ]);
        $row = AcademyBookmark::query()->firstOrCreate([
            'user_id' => $request->user()->id,
            'bookmarkable_type' => $data['bookmarkable_type'],
            'bookmarkable_id' => $data['bookmarkable_id'],
        ]);

        return response()->json(['bookmark' => $row], 201);
    }

    public function destroyBookmark(Request $request, AcademyBookmark $bookmark)
    {
        $this->access->assertOwnUser($request->user(), (int) $bookmark->user_id);
        $bookmark->delete();

        return response()->json(['ok' => true]);
    }

    public function notes(Request $request)
    {
        $this->access->assertAcademySurface($request->user());

        return response()->json(['data' => AcademyNote::query()->where('user_id', $request->user()->id)->latest()->get()]);
    }

    public function storeNote(Request $request)
    {
        $this->access->assertAcademySurface($request->user());
        $data = $request->validate([
            'notable_type' => 'required|string',
            'notable_id' => 'required|integer',
            'body' => 'required|string',
        ]);
        $note = AcademyNote::query()->create([
            'user_id' => $request->user()->id,
            ...$data,
        ]);

        return response()->json(['note' => $note], 201);
    }

    public function updateNote(Request $request, AcademyNote $note)
    {
        $this->access->assertOwnUser($request->user(), (int) $note->user_id);
        $note->update($request->validate(['body' => 'required|string']));

        return response()->json(['note' => $note]);
    }

    public function destroyNote(Request $request, AcademyNote $note)
    {
        $this->access->assertOwnUser($request->user(), (int) $note->user_id);
        $note->delete();

        return response()->json(['ok' => true]);
    }

    public function planner(Request $request)
    {
        $this->access->assertAcademySurface($request->user());

        return response()->json([
            'plan' => AcademyStudyPlan::query()->with('items')->where('user_id', $request->user()->id)->latest()->first(),
        ]);
    }

    public function savePlanner(Request $request)
    {
        return response()->json(['plan' => $this->planner->upsert($request->user(), $request->all())]);
    }

    public function sources(Request $request)
    {
        $this->access->assertAcademySurface($request->user());

        return response()->json([
            'disclaimer' => config('academy.disclaimer'),
            'data' => AcademyLegalSource::query()->where('status', 'published')->orderBy('title')->get(),
        ]);
    }

    public function showSource(Request $request, AcademyLegalSource $source)
    {
        $this->access->assertAcademySurface($request->user());
        if ($source->status !== 'published') {
            abort(404);
        }

        return response()->json([
            'source' => $source,
            'disclaimer' => config('academy.disclaimer'),
        ]);
    }

    public function reportQuestion(Request $request, AcademyQuestion $question)
    {
        $this->access->assertAcademySurface($request->user());
        $data = $request->validate([
            'reason' => 'required|in:unclear,wrong_answer,outdated_law,broken_source,typo,duplicate',
            'comment' => 'nullable|string',
        ]);
        $report = AcademyQuestionReport::query()->create([
            'user_id' => $request->user()->id,
            'question_id' => $question->id,
            'question_version_id' => $question->current_published_version_id,
            'reason' => $data['reason'],
            'comment' => $data['comment'] ?? null,
            'status' => 'open',
        ]);
        $this->notifications->questionReported($question->id);

        return response()->json(['report' => $report], 201);
    }
}
