<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Academy\AcademyAiGenerationJob;
use App\Models\Academy\AcademyCourse;
use App\Models\Academy\AcademyCourseQuestion;
use App\Models\Academy\AcademyExam;
use App\Models\Academy\AcademyExamEvidenceItem;
use App\Models\Academy\AcademyExamTemplate;
use App\Models\Academy\AcademyQuestion;
use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsExam;
use App\Services\Academy\Ai\AcademyAiJobService;
use App\Services\Learning\ExamEvidencePackService;
use App\Services\Lms\Ai\LmsAiJobService;
use App\Support\Learning\LearningCatalogCard;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminLearningExamController extends Controller
{
    public function __construct(
        private ExamEvidencePackService $evidence,
        private AcademyAiJobService $jobs,
        private LmsAiJobService $lmsJobs,
    ) {}

    public function index(Request $request)
    {
        $domain = $this->domain($request);
        $rows = $domain === 'client_lms'
            ? LmsExam::query()->latest()->get()
            : AcademyExam::query()->latest()->get();

        return response()->json(['data' => $rows, 'product_domain' => $domain]);
    }

    public function store(Request $request)
    {
        $domain = $this->domain($request);
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'key' => 'nullable|string|max:80',
            'generation_profile' => 'nullable|string',
            'exam_authority' => 'nullable|string',
            'official_exam_url' => 'nullable|url',
            'content_language' => 'nullable|in:en,fr,bilingual',
            'description' => 'nullable|string',
        ]);
        $key = $data['key'] ?? Str::slug($data['name']);
        $profile = $data['generation_profile'] ?? ($domain === 'client_lms' ? 'language_exam_prep' : 'rcic_exam_prep');
        $attrs = [
            'product_domain' => $domain,
            'audience' => $domain === 'client_lms' ? 'client' : 'rcic',
            'key' => $key,
            'slug' => $key,
            'generation_profile' => $profile,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'exam_authority' => $data['exam_authority'] ?? null,
            'official_exam_url' => $data['official_exam_url'] ?? null,
            'content_language' => $data['content_language'] ?? 'en',
            'status' => 'draft',
            'created_by' => $request->user()->id,
            'next_review_at' => $this->evidence->nextReviewAt($profile),
            'verification_interval_days' => config('learning.verification_intervals_days.'.$profile),
        ];
        $exam = $domain === 'client_lms' ? LmsExam::query()->create($attrs) : AcademyExam::query()->create($attrs);
        $this->evidence->ensurePack($domain, (int) $exam->id);

        return response()->json(['exam' => $exam], 201);
    }

    public function show(Request $request, int $exam)
    {
        $domain = $this->domain($request);
        $model = $this->evidence->exam($domain, $exam);
        $pack = $this->evidence->ensurePack($domain, $exam);

        return response()->json([
            'exam' => $model,
            'evidence_pack' => $pack->load('items'),
            'evidence_summary' => $this->evidence->evidenceSummary($domain, $exam),
            'field_audits' => $model->fieldAudits()->latest()->limit(50)->get(),
        ]);
    }

    public function update(Request $request, int $exam)
    {
        $domain = $this->domain($request);
        $model = $this->evidence->exam($domain, $exam);
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'exam_authority' => 'nullable|string',
            'official_exam_url' => 'nullable|url',
            'generation_profile' => 'nullable|string',
            'reason' => 'nullable|string',
        ]);
        $reason = $data['reason'] ?? 'admin_edit';
        unset($data['reason']);
        foreach ($data as $field => $value) {
            $previous = $model->{$field};
            if ((string) $previous === (string) $value) {
                continue;
            }
            $model->{$field} = $value;
            $model->save();
            $this->evidence->exam($domain, $exam);
            $auditClass = $domain === 'client_lms' ? \App\Models\Lms\LmsExamFieldAudit::class : \App\Models\Academy\AcademyExamFieldAudit::class;
            $auditClass::query()->create([
                'exam_id' => $exam,
                'actor_user_id' => $request->user()->id,
                'field' => $field,
                'previous_value' => is_scalar($previous) ? (string) $previous : json_encode($previous),
                'new_value' => is_scalar($value) ? (string) $value : json_encode($value),
                'reason' => $reason,
            ]);
        }

        return response()->json(['exam' => $model->fresh()]);
    }

    public function assertStructure(Request $request, int $exam)
    {
        $domain = $this->domain($request);
        $data = $request->validate([
            'exam_format_json' => 'required|array',
            'reason' => 'required|string|min:3',
            'supporting_url' => 'nullable|url',
        ]);
        $model = $this->evidence->markAdminAssertedStructure(
            $domain,
            $exam,
            $request->user(),
            $data['exam_format_json'],
            $data['reason'],
            $data['supporting_url'] ?? null
        );

        return response()->json(['exam' => $model, 'evidence_summary' => $this->evidence->evidenceSummary($domain, $exam)]);
    }

    public function confirmOfficialStructure(Request $request, int $exam)
    {
        $domain = $this->domain($request);
        $data = $request->validate([
            'item_id' => 'required|integer',
            'exam_format_json' => 'required|array',
            'exam_format_json.duration_minutes' => 'required|integer|min:1',
            'exam_format_json.total_questions' => 'required|integer|min:1',
        ]);
        $item = $domain === 'client_lms'
            ? \App\Models\Lms\LmsExamEvidenceItem::query()->findOrFail($data['item_id'])
            : AcademyExamEvidenceItem::query()->findOrFail($data['item_id']);
        $model = $this->evidence->exam($domain, $exam);
        $this->evidence->applyOfficialStructure($model, $data['exam_format_json'], $item);

        return response()->json([
            'exam' => $model->fresh(),
            'evidence_summary' => $this->evidence->evidenceSummary($domain, $exam),
        ]);
    }

    public function addSource(Request $request, int $exam)
    {
        $domain = $this->domain($request);
        $data = $request->validate([
            'source_type' => 'required|string',
            'url' => 'nullable|string',
            'title' => 'nullable|string',
            'authority' => 'nullable|string',
            'is_official' => 'sometimes|boolean',
            'verification_status' => 'nullable|string',
            'usage_permission_status' => 'nullable|string',
            'robots_txt_allowed' => 'sometimes|boolean',
            'licence_allows_reuse' => 'sometimes|boolean',
            'body' => 'nullable|string',
            'excerpt' => 'nullable|string',
            'content_hash' => 'nullable|string',
            'version_label' => 'nullable|string',
            'effective_date' => 'nullable|date',
            'publication_date' => 'nullable|date',
            'suspected_leak' => 'sometimes|boolean',
            'pattern_metadata_json' => 'nullable|array',
        ]);
        $item = $this->evidence->ingestItem($domain, $exam, $data, $request->user());

        return response()->json(['item' => $item, 'evidence_summary' => $this->evidence->evidenceSummary($domain, $exam)], 201);
    }

    public function verifySource(Request $request, int $exam, int $item)
    {
        $domain = $this->domain($request);
        $row = $domain === 'client_lms'
            ? \App\Models\Lms\LmsExamEvidenceItem::query()->findOrFail($item)
            : AcademyExamEvidenceItem::query()->findOrFail($item);
        if ($row->classification_flag === 'unverified_exam_material') {
            throw ValidationException::withMessages(['item' => 'Unverified exam material cannot become authoritative.']);
        }
        $row->verification_status = 'verified';
        $row->save();
        $this->evidence->ensurePack($domain, $exam);

        return response()->json(['item' => $row->fresh(), 'evidence_summary' => $this->evidence->evidenceSummary($domain, $exam)]);
    }

    public function disableSource(Request $request, int $exam, int $item)
    {
        $domain = $this->domain($request);
        $row = $domain === 'client_lms'
            ? \App\Models\Lms\LmsExamEvidenceItem::query()->findOrFail($item)
            : AcademyExamEvidenceItem::query()->findOrFail($item);
        $row->disabled = true;
        $row->save();

        return response()->json(['item' => $row->fresh(), 'evidence_summary' => $this->evidence->evidenceSummary($domain, $exam)]);
    }

    public function snapshot(Request $request, int $exam, int $item)
    {
        $row = $this->domain($request) === 'client_lms'
            ? \App\Models\Lms\LmsExamEvidenceItem::query()->findOrFail($item)
            : AcademyExamEvidenceItem::query()->findOrFail($item);

        return response()->json([
            'id' => $row->id,
            'url' => $row->url,
            'content_hash' => $row->content_hash,
            'full_file_stored' => $row->full_file_stored,
            'usage_permission_status' => $row->usage_permission_status,
            'excerpt' => $row->excerpt,
            'pattern_metadata_json' => $row->pattern_metadata_json,
        ]);
    }

    public function recordResearch(Request $request, int $exam)
    {
        $domain = $this->domain($request);
        $data = $request->validate([
            'manus_research_json' => 'required|array',
            'openai_verification_json' => 'required|array',
        ]);
        $pack = $this->evidence->ensurePack($domain, $exam);
        $comparison = $this->evidence->recordIndependentResearch($pack, $data['manus_research_json'], $data['openai_verification_json']);
        $examModel = $this->evidence->exam($domain, $exam);
        $this->evidence->manusCannotWriteExam($examModel, $data['manus_research_json']);

        return response()->json([
            'comparison' => $comparison,
            'pack' => $pack->fresh(),
            'exam' => $examModel->fresh(),
        ]);
    }

    public function approvePack(Request $request, int $exam)
    {
        $domain = $this->domain($request);
        $pack = $this->evidence->approvePack($domain, $exam, $request->user());

        return response()->json([
            'pack' => $pack,
            'evidence_summary' => $this->evidence->evidenceSummary($domain, $exam),
        ]);
    }

    public function generateCourse(Request $request, int $exam)
    {
        $domain = $this->domain($request);
        $data = $request->validate([
            'title' => 'nullable|string',
            'include_mock' => 'sometimes|boolean',
            'warning_code' => 'nullable|string',
            'override_reason' => 'nullable|string',
            'generate_lessons' => 'sometimes|boolean',
            'generate_independent_mcqs' => 'sometimes|boolean',
            'generate_cases' => 'sometimes|boolean',
            'generate_case_mcqs' => 'sometimes|boolean',
            'content_language' => 'nullable|in:en,fr',
            'independent_count' => 'nullable|integer|min:0|max:20',
            'case_based_count' => 'nullable|integer|min:0|max:20',
            'case_count' => 'nullable|integer|min:0|max:5',
            'module_count' => 'nullable|integer|min:1|max:10',
            'lesson_count' => 'nullable|integer|min:1|max:20',
            'mock_question_count' => 'nullable|integer|min:1|max:20',
        ]);
        $gate = $this->evidence->generationGate($domain, $exam, $request->user(), $data);
        if (! $gate['ok']) {
            return response()->json([
                'message' => $gate['message'],
                'code' => $gate['code'],
                'evidence_summary' => $gate['summary'],
            ], 422);
        }
        $examModel = $this->evidence->exam($domain, $exam);
        $pack = $this->evidence->ensurePack($domain, $exam);
        if ($domain === 'client_lms') {
            $profile = (string) $examModel->generation_profile;
            $usesCases = (bool) config('learning.generation_profiles.'.$profile.'.uses_cases', false);
            $independent = (int) ($data['independent_count'] ?? 10);
            $job = $this->lmsJobs->create([
                'type' => 'course',
                'title' => $data['title'] ?? $examModel->name,
                'exam_id' => $exam,
                'evidence_pack_id' => $pack->id,
                'generation_profile' => $profile,
                'content_language' => $data['content_language'] ?? $examModel->content_language ?? 'en',
                'goal' => 'Evidence-grounded Client LMS course for '.$examModel->name,
                'generate_lessons' => $data['generate_lessons'] ?? true,
                'generate_independent_mcqs' => $data['generate_independent_mcqs'] ?? true,
                'generate_cases' => $usesCases && ($data['generate_cases'] ?? false),
                'generate_case_mcqs' => $usesCases && ($data['generate_case_mcqs'] ?? false),
                'include_mock' => $data['include_mock'] ?? true,
                'independent_count' => $independent,
                'case_based_count' => $usesCases ? ($data['case_based_count'] ?? 0) : 0,
                'case_count' => $usesCases ? ($data['case_count'] ?? 0) : 0,
                'module_count' => $data['module_count'] ?? 1,
                'lesson_count' => $data['lesson_count'] ?? 2,
                'mock_question_count' => $data['mock_question_count'] ?? $independent,
            ], $request->user());

            return response()->json([
                'job_id' => $job->id,
                'status' => $job->status,
                'exam_id' => $exam,
                'generation_profile' => $profile,
                'evidence_summary' => $gate['summary'],
            ], 201);
        }

        $job = $this->jobs->create([
            'type' => 'course',
            'title' => $data['title'] ?? $examModel->name,
            'exam_id' => $exam,
            'evidence_pack_id' => $pack->id,
            'generation_profile' => $examModel->generation_profile,
            'goal' => 'Evidence-grounded course for '.$examModel->name,
            'generate_lessons' => $data['generate_lessons'] ?? true,
            'generate_independent_mcqs' => $data['generate_independent_mcqs'] ?? true,
            'generate_cases' => $data['generate_cases'] ?? true,
            'generate_case_mcqs' => $data['generate_case_mcqs'] ?? true,
            'blueprint_requires_evidence' => true,
            'independent_count' => $data['independent_count'] ?? 10,
            'case_based_count' => $data['case_based_count'] ?? 10,
            'case_count' => $data['case_count'] ?? 2,
        ], $request->user());
        $job->exam_id = $exam;
        $job->evidence_pack_id = $pack->id;
        $job->generation_profile = $examModel->generation_profile;
        $job->save();

        return response()->json([
            'job_id' => $job->id,
            'status' => $job->status,
            'exam_id' => $exam,
            'evidence_summary' => $gate['summary'],
        ], 201);
    }

    public function catalog(Request $request)
    {
        $domain = $this->domain($request);
        $locale = $request->query('locale', 'en');
        if ($domain === 'client_lms') {
            $courses = LmsCourse::query()->where('is_published', true)->get();
            $cards = $courses->map(function (LmsCourse $course) use ($locale) {
                $exam = $course->exam_id ? LmsExam::query()->find($course->exam_id) : null;

                return LearningCatalogCard::fromDomain('client_lms', $course->toArray() + ['translations' => []], $exam?->toArray(), $locale);
            });
        } else {
            $courses = AcademyCourse::query()->where('status', 'published')->get();
            $cards = $courses->map(function (AcademyCourse $course) use ($locale) {
                $exam = $course->exam_id ? AcademyExam::query()->find($course->exam_id) : null;

                return LearningCatalogCard::fromDomain('rcic_academy', $course->toArray() + ['translations' => []], $exam?->toArray(), $locale);
            });
        }

        return response()->json(['data' => $cards->values()]);
    }

    public function questionBank(Request $request, int $exam)
    {
        $domain = $this->domain($request);
        if ($domain === 'client_lms') {
            $questions = \App\Models\Lms\LmsExamQuestion::query()->with('versions')->where('exam_id', $exam)->latest()->get();

            return response()->json(['data' => $questions]);
        }
        $questions = AcademyQuestion::query()->with('versions')->where('exam_id', $exam)->latest()->get();

        return response()->json(['data' => $questions]);
    }

    public function storeQuestion(Request $request, int $exam)
    {
        $domain = $this->domain($request);
        if ($domain === 'client_lms') {
            throw ValidationException::withMessages(['domain' => 'Use LMS exam question endpoints.']);
        }
        $data = $request->validate([
            'type' => 'required|in:independent_mcq,case_mcq',
            'question_text' => 'required|string',
            'explanation' => 'nullable|string',
            'difficulty' => 'nullable|string',
            'options' => 'required|array|min:2',
            'options.*.option_text' => 'required|string',
            'options.*.is_correct' => 'required|boolean',
            'practice_eligible' => 'sometimes|boolean',
            'mock_eligible' => 'sometimes|boolean',
            'course_id' => 'nullable|integer',
        ]);
        $question = AcademyQuestion::query()->create([
            'exam_id' => $exam,
            'type' => $data['type'],
            'status' => 'draft',
            'created_by' => $request->user()->id,
            'practice_eligible' => $data['practice_eligible'] ?? true,
            'mock_eligible' => $data['mock_eligible'] ?? true,
        ]);
        $version = $question->versions()->create([
            'version_number' => 1,
            'question_text' => $data['question_text'],
            'explanation' => $data['explanation'] ?? null,
            'difficulty' => $data['difficulty'] ?? 'medium',
            'status' => 'draft',
            'author_user_id' => $request->user()->id,
            'provenance_json' => [
                'exam_id' => $exam,
                'generation_job_id' => null,
                'generation_profile' => $this->evidence->exam($domain, $exam)->generation_profile,
                'manual' => true,
            ],
        ]);
        foreach ($data['options'] as $i => $option) {
            $version->options()->create([
                'option_key' => chr(65 + $i),
                'option_text' => $option['option_text'],
                'is_correct' => $option['is_correct'],
                'sort_order' => $i,
            ]);
        }
        if (! empty($data['course_id'])) {
            AcademyCourseQuestion::query()->create([
                'course_id' => $data['course_id'],
                'question_id' => $question->id,
                'practice_eligible' => $data['practice_eligible'] ?? true,
                'mock_eligible' => $data['mock_eligible'] ?? true,
            ]);
        }

        return response()->json(['question' => $question->fresh('versions')], 201);
    }

    public function storeMockTemplate(Request $request, int $exam)
    {
        $domain = $this->domain($request);
        $data = $request->validate([
            'name' => 'required|string',
            'course_id' => 'nullable|integer',
            'total_questions' => 'required|integer|min:1',
            'duration_minutes' => 'required|integer|min:1',
            'independent_count' => 'nullable|integer',
            'case_based_count' => 'nullable|integer',
            'selection_mode' => 'nullable|in:random_pool,fixed_form',
            'allow_fallback_mix' => 'sometimes|boolean',
        ]);
        $format = $this->evidence->exam($domain, $exam)->exam_format_json ?? [];
        $summary = $this->evidence->evidenceSummary($domain, $exam);
        if ($summary['critical_structure_unverified']) {
            return response()->json(['message' => 'Critical structure unverified', 'code' => 'critical_structure_unverified'], 422);
        }
        $eligible = $domain === 'client_lms'
            ? \App\Models\Lms\LmsExamQuestion::query()->where('exam_id', $exam)->where('mock_eligible', true)->count()
            : AcademyQuestion::query()->where('exam_id', $exam)->where('status', 'published')->where('mock_eligible', true)->count();
        $poolCheck = $this->evidence->mockPoolSufficient(
            $eligible,
            ['total' => $data['total_questions']],
            [],
            (bool) ($data['allow_fallback_mix'] ?? false)
        );
        if (! $poolCheck['ok'] && ($data['publish'] ?? false)) {
            return response()->json(['message' => $poolCheck['message'], 'code' => $poolCheck['code']], 422);
        }

        $slug = Str::slug($data['name']).'-'.$exam.'-'.Str::random(4);
        $duration = $data['duration_minutes'] ?: ($format['duration_minutes'] ?? 60);
        if ($domain === 'client_lms') {
            $template = \App\Models\Lms\LmsExamTemplate::query()->create([
                'exam_id' => $exam,
                'course_id' => $data['course_id'] ?? null,
                'name' => $data['name'],
                'slug' => $slug,
                'total_questions' => $data['total_questions'],
                'duration_minutes' => $duration,
                'independent_count' => $data['independent_count'] ?? $data['total_questions'],
                'case_based_count' => $data['case_based_count'] ?? 0,
                'selection_mode' => $data['selection_mode'] ?? 'random_pool',
                'allow_answer_review_after_submit' => true,
                'status' => 'draft',
                'created_by' => $request->user()->id,
            ]);

            return response()->json(['template' => $template, 'pool' => $poolCheck], 201);
        }

        $template = AcademyExamTemplate::query()->create([
            'exam_id' => $exam,
            'course_id' => $data['course_id'] ?? null,
            'track_id' => null,
            'name' => $data['name'],
            'slug' => $slug,
            'total_questions' => $data['total_questions'],
            'duration_minutes' => $duration,
            'independent_count' => $data['independent_count'] ?? 0,
            'case_based_count' => $data['case_based_count'] ?? 0,
            'selection_mode' => $data['selection_mode'] ?? 'random_pool',
            'allow_answer_review_after_submit' => true,
            'status' => 'draft',
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['template' => $template, 'pool' => $poolCheck], 201);
    }

    private function domain(Request $request): string
    {
        $domain = $request->query('product_domain', $request->input('product_domain', 'rcic_academy'));

        return $domain === 'client_lms' ? 'client_lms' : 'rcic_academy';
    }
}
