<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Academy\AcademyCase;
use App\Models\Academy\AcademyCaseExhibit;
use App\Models\Academy\AcademyCaseVersion;
use App\Models\Academy\AcademyCompetency;
use App\Models\Academy\AcademyContentSourceLink;
use App\Models\Academy\AcademyCourse;
use App\Models\Academy\AcademyCourseVersion;
use App\Models\Academy\AcademyEntitlement;
use App\Models\Academy\AcademyExamTemplate;
use App\Models\Academy\AcademyLearningTrack;
use App\Models\Academy\AcademyLegalSource;
use App\Models\Academy\AcademyLesson;
use App\Models\Academy\AcademyModule;
use App\Models\Academy\AcademyOutdatedFlag;
use App\Models\Academy\AcademyQuestion;
use App\Models\Academy\AcademyQuestionReport;
use App\Models\Academy\AcademyQuestionVersion;
use App\Models\Academy\AcademyTopic;
use App\Services\Academy\AcademyAnalyticsService;
use App\Services\Academy\AcademyCourseService;
use App\Services\Academy\AcademyNotificationService;
use App\Services\Academy\AcademyOutdatedService;
use App\Services\Academy\AcademyQuestionService;
use App\Services\Academy\AcademyWorkflow;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminAcademyController extends Controller
{
    public function __construct(
        private AcademyCourseService $courses,
        private AcademyQuestionService $questions,
        private AcademyWorkflow $workflow,
        private AcademyOutdatedService $outdated,
        private AcademyAnalyticsService $analytics,
        private AcademyNotificationService $notifications,
    ) {}

    public function dashboard()
    {
        return response()->json([
            'courses' => AcademyCourse::query()->count(),
            'questions' => AcademyQuestion::query()->count(),
            'published_questions' => AcademyQuestion::query()->where('status', 'published')->count(),
            'open_reports' => AcademyQuestionReport::query()->where('status', 'open')->count(),
            'outdated' => AcademyOutdatedFlag::query()->where('status', 'pending')->count(),
        ]);
    }

    public function tracks()
    {
        return response()->json(['data' => AcademyLearningTrack::query()->orderBy('sort_order')->get()]);
    }

    public function topics()
    {
        return response()->json(['data' => AcademyTopic::query()->orderBy('sort_order')->get()]);
    }

    public function storeTopic(Request $request)
    {
        $data = $request->validate([
            'key' => 'required|string|unique:academy.academy_topics,key',
            'name' => 'required|string',
            'track_id' => 'nullable|integer',
            'division' => 'nullable|string',
        ]);

        return response()->json(['topic' => AcademyTopic::query()->create($data + ['is_active' => true, 'sort_order' => 99])], 201);
    }

    public function competencies()
    {
        return response()->json(['data' => AcademyCompetency::query()->orderBy('sort_order')->get()]);
    }

    public function storeCompetency(Request $request)
    {
        $data = $request->validate([
            'key' => 'required|string|unique:academy.academy_competencies,key',
            'name' => 'required|string',
        ]);

        return response()->json(['competency' => AcademyCompetency::query()->create($data + ['is_active' => true, 'sort_order' => 99])], 201);
    }

    public function sources()
    {
        return response()->json(['data' => AcademyLegalSource::query()->latest()->get()]);
    }

    public function storeSource(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'source_organization' => 'nullable|string',
            'source_url' => 'nullable|string',
            'source_type' => 'nullable|string',
            'citation_label' => 'nullable|string',
            'summary' => 'nullable|string',
            'legislation_document_id' => 'nullable|integer',
            'status' => 'nullable|string',
        ]);
        $row = AcademyLegalSource::query()->create($data + [
            'created_by' => $request->user()->id,
            'status' => $data['status'] ?? 'draft',
        ]);

        return response()->json(['source' => $row], 201);
    }

    public function transitionSource(Request $request, AcademyLegalSource $source)
    {
        $to = $request->validate(['status' => 'required|string', 'override' => 'sometimes|boolean', 'comment' => 'nullable|string'])['status'];
        $this->workflow->transition($source, $to, $request->user(), $request->input('comment'), (bool) $request->boolean('override'));

        return response()->json(['source' => $source->fresh()]);
    }

    public function markSourceOutdated(Request $request, AcademyLegalSource $source)
    {
        $count = $this->outdated->markSource($source, $request->input('reason', 'source_changed'), $request->user());
        $this->notifications->sourceOutdated($source->title);

        return response()->json(['flagged' => $count]);
    }

    public function courses()
    {
        return response()->json(['data' => AcademyCourse::query()->with('versions')->latest()->get()]);
    }

    public function storeCourse(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'slug' => 'nullable|string',
            'description' => 'nullable|string',
            'track_id' => 'nullable|integer',
            'access_tier' => 'nullable|in:subscription,free,grant_required',
            'difficulty' => 'nullable|string',
            'estimated_hours' => 'nullable|numeric',
        ]);

        return response()->json(['course' => $this->courses->createDraft($data, $request->user())], 201);
    }

    public function newCourseDraft(Request $request, AcademyCourse $course)
    {
        return response()->json(['version' => $this->courses->draftVersionForEdit($course, $request->user())], 201);
    }

    public function showCourse(AcademyCourse $course)
    {
        return response()->json(['course' => $course->load('versions.modules.lessons')]);
    }

    public function storeModule(Request $request, AcademyCourseVersion $version)
    {
        $data = $request->validate(['title' => 'required|string', 'sort_order' => 'nullable|integer']);

        return response()->json(['module' => AcademyModule::query()->create([
            'course_version_id' => $version->id,
            'title' => $data['title'],
            'sort_order' => $data['sort_order'] ?? 0,
        ])], 201);
    }

    public function storeLesson(Request $request, AcademyModule $module)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'lesson_type' => 'required|string',
            'body_html' => 'nullable|string',
            'media_url' => 'nullable|string',
            'duration_minutes' => 'nullable|integer',
            'topic_ids' => 'nullable|array',
            'competency_ids' => 'nullable|array',
        ]);
        $lesson = AcademyLesson::query()->create([
            'module_id' => $module->id,
            'title' => $data['title'],
            'lesson_type' => $data['lesson_type'],
            'body_html' => $data['body_html'] ?? null,
            'media_url' => $data['media_url'] ?? null,
            'media_disk' => $data['media_url'] ? config('academy.media_disk') : null,
            'duration_minutes' => $data['duration_minutes'] ?? null,
            'sort_order' => 0,
        ]);
        if (! empty($data['topic_ids'])) {
            $lesson->topics()->sync($data['topic_ids']);
        }
        if (! empty($data['competency_ids'])) {
            $lesson->competencies()->sync($data['competency_ids']);
        }

        return response()->json(['lesson' => $lesson], 201);
    }

    public function uploadLessonMedia(Request $request, AcademyLesson $lesson)
    {
        $request->validate(['file' => 'required|file|max:51200']);
        $disk = config('academy.media_disk');
        $path = $request->file('file')->store('lessons', $disk);
        $lesson->update(['media_url' => $path, 'media_disk' => $disk]);

        return response()->json(['lesson' => $lesson]);
    }

    public function transitionCourseVersion(Request $request, AcademyCourse $course, AcademyCourseVersion $version)
    {
        $to = $request->validate(['status' => 'required|string', 'override' => 'sometimes|boolean', 'comment' => 'nullable|string'])['status'];
        if ($to === 'published') {
            $this->courses->publishVersion($course, $version, $request->user(), $this->workflow, (bool) $request->boolean('override'));
        } else {
            $this->workflow->transition($version, $to, $request->user(), $request->input('comment'), (bool) $request->boolean('override'));
            if ($to === 'legal_review') {
                $this->notifications->legalReviewPending($course->title);
            }
        }

        return response()->json(['course' => $course->fresh('versions')]);
    }

    public function questions()
    {
        return response()->json(['data' => AcademyQuestion::query()->with('publishedVersion.options')->latest()->get()]);
    }

    public function storeQuestion(Request $request)
    {
        $data = $request->validate([
            'type' => 'required|in:independent_mcq,case_mcq',
            'question_text' => 'required|string',
            'explanation' => 'nullable|string',
            'difficulty' => 'nullable|string',
            'case_version_id' => 'nullable|integer',
            'topic_ids' => 'nullable|array',
            'competency_ids' => 'nullable|array',
            'options' => 'required|array|min:2',
            'options.*.option_text' => 'required|string',
            'options.*.is_correct' => 'required|boolean',
            'options.*.incorrect_explanation' => 'nullable|string',
        ]);

        return response()->json(['question' => $this->questions->createDraft($data, $request->user())], 201);
    }

    public function transitionQuestionVersion(Request $request, AcademyQuestion $question, AcademyQuestionVersion $version)
    {
        $to = $request->validate(['status' => 'required|string', 'override' => 'sometimes|boolean', 'comment' => 'nullable|string'])['status'];
        if ($to === 'published') {
            $this->questions->publish($question, $version, $request->user(), $this->workflow, (bool) $request->boolean('override'));
        } else {
            $this->workflow->transition($version, $to, $request->user(), $request->input('comment'), (bool) $request->boolean('override'));
        }

        return response()->json(['question' => $question->fresh('versions.options')]);
    }

    public function newQuestionDraft(Request $request, AcademyQuestion $question)
    {
        return response()->json(['version' => $this->questions->newDraftFromPublished($question, $request->user())], 201);
    }

    public function linkSource(Request $request)
    {
        $data = $request->validate([
            'legal_source_id' => 'required|integer',
            'linkable_type' => 'required|string',
            'linkable_id' => 'required|integer',
            'section_label' => 'nullable|string',
        ]);

        return response()->json(['link' => AcademyContentSourceLink::query()->firstOrCreate($data)], 201);
    }

    public function cases()
    {
        return response()->json(['data' => AcademyCase::query()->with('versions')->latest()->get()]);
    }

    public function storeCase(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'facts' => 'nullable|string',
            'track_id' => 'nullable|integer',
        ]);
        $case = AcademyCase::query()->create([
            'title' => $data['title'],
            'slug' => Str::slug($data['title']).'-'.Str::lower(Str::random(5)),
            'track_id' => $data['track_id'] ?? null,
            'status' => 'draft',
            'created_by' => $request->user()->id,
        ]);
        $version = AcademyCaseVersion::query()->create([
            'case_id' => $case->id,
            'version_number' => 1,
            'facts' => $data['facts'] ?? null,
            'status' => 'draft',
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['case' => $case->fresh('versions'), 'version' => $version], 201);
    }

    public function storeExhibit(Request $request, AcademyCaseVersion $version)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'exhibit_type' => 'nullable|string',
            'body_html' => 'nullable|string',
        ]);

        return response()->json(['exhibit' => AcademyCaseExhibit::query()->create($data + [
            'case_version_id' => $version->id,
            'sort_order' => 0,
        ])], 201);
    }

    public function attachCaseQuestion(Request $request, AcademyCaseVersion $version)
    {
        $data = $request->validate(['question_id' => 'required|integer']);
        $version->questions()->syncWithoutDetaching([$data['question_id'] => ['sort_order' => 0]]);

        return response()->json(['ok' => true]);
    }

    public function transitionCaseVersion(Request $request, AcademyCase $case, AcademyCaseVersion $version)
    {
        $to = $request->validate(['status' => 'required|string', 'override' => 'sometimes|boolean', 'comment' => 'nullable|string'])['status'];
        $this->workflow->transition($version, $to, $request->user(), $request->input('comment'), (bool) $request->boolean('override'));
        if ($to === 'published') {
            $case->update(['status' => 'published', 'current_published_version_id' => $version->id]);
        }

        return response()->json(['case' => $case->fresh('versions')]);
    }

    public function examTemplates()
    {
        return response()->json(['data' => AcademyExamTemplate::query()->orderBy('name')->get()]);
    }

    public function storeExamTemplate(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'slug' => 'nullable|string',
            'total_questions' => 'required|integer|min:1',
            'duration_minutes' => 'required|integer|min:1',
            'independent_count' => 'required|integer|min:0',
            'case_based_count' => 'required|integer|min:0',
            'randomize_questions' => 'sometimes|boolean',
            'randomize_options' => 'sometimes|boolean',
            'max_attempts' => 'nullable|integer',
            'track_id' => 'nullable|integer',
            'status' => 'nullable|string',
        ]);
        $row = AcademyExamTemplate::query()->create($data + [
            'slug' => $data['slug'] ?? Str::slug($data['name']).'-'.Str::lower(Str::random(4)),
            'status' => $data['status'] ?? 'draft',
            'version_number' => 1,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['template' => $row], 201);
    }

    public function updateExamTemplate(Request $request, AcademyExamTemplate $template)
    {
        $template->update($request->validate([
            'name' => 'sometimes|string',
            'total_questions' => 'sometimes|integer',
            'duration_minutes' => 'sometimes|integer',
            'independent_count' => 'sometimes|integer',
            'case_based_count' => 'sometimes|integer',
            'randomize_questions' => 'sometimes|boolean',
            'randomize_options' => 'sometimes|boolean',
            'max_attempts' => 'nullable|integer',
            'status' => 'sometimes|string',
            'pass_threshold_percent' => 'sometimes|integer',
        ]));

        return response()->json(['template' => $template]);
    }

    public function entitlements(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'required|integer',
            'type' => 'required|string',
            'course_id' => 'nullable|integer',
            'track_id' => 'nullable|integer',
            'notes' => 'nullable|string',
        ]);
        $row = AcademyEntitlement::query()->create($data + [
            'is_active' => true,
            'created_by' => $request->user()->id,
            'starts_at' => now(),
        ]);

        return response()->json(['entitlement' => $row], 201);
    }

    public function reports()
    {
        return response()->json(['data' => AcademyQuestionReport::query()->latest()->get()]);
    }

    public function outdated()
    {
        return response()->json(['data' => AcademyOutdatedFlag::query()->latest()->get()]);
    }

    public function resolveOutdated(Request $request, AcademyOutdatedFlag $flag)
    {
        $flag->update([
            'status' => $request->input('status', 'reviewed'),
            'resolved_at' => now(),
            'resolved_by' => $request->user()->id,
        ]);

        return response()->json(['flag' => $flag]);
    }

    public function analytics()
    {
        return response()->json(['questions' => $this->analytics->adminQuestionStats()]);
    }
}
