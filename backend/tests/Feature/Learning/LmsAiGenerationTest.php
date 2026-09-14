<?php

namespace Tests\Feature\Learning;

use App\Models\Academy\AcademyAiGenerationJob;
use App\Models\Academy\AcademyCourse;
use App\Models\Academy\AcademyLesson;
use App\Models\Academy\AcademyModule;
use App\Models\Academy\AcademyQuestion;
use App\Models\Lms\LmsAiGenerationJob;
use App\Models\Lms\LmsCategory;
use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsCourseAssignment;
use App\Models\Lms\LmsCourseQuestion;
use App\Models\Lms\LmsExam;
use App\Models\Lms\LmsExamQuestion;
use App\Models\Lms\LmsExamTemplate;
use App\Models\Lms\LmsLesson;
use App\Models\Lms\LmsModule;
use App\Models\User;
use App\Services\Academy\Ai\AcademyAiPromptCatalog;
use App\Services\Academy\Ai\Providers\FakeAcademyGenerationProvider;
use App\Services\Learning\ExamEvidencePackService;
use App\Services\Lms\Ai\LmsAiPromptCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesSubscriptionFixtures;
use Tests\Concerns\RefreshesAcademyDatabase;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class LmsAiGenerationTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesAcademyDatabase;
    use RefreshesLmsDatabase;
    use CreatesSubscriptionFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resetAcademySchema();
        $this->ensureLmsTestSchema();
        $this->seedBillingRoles();
        config([
            'academy_ai.enabled' => true,
            'academy_ai.research_driver' => 'fake',
            'academy_ai.generation_driver' => 'fake',
            'academy_ai.manus.enabled' => false,
            'academy_ai.manus.api_key' => null,
        ]);
        $this->app->singleton(FakeAcademyGenerationProvider::class);
    }

    public function test_generate_course_is_not_a_stub_and_imports_lms_drafts(): void
    {
        $academyCourses = AcademyCourse::query()->count();
        $academyModules = AcademyModule::query()->count();
        $academyLessons = AcademyLesson::query()->count();
        $academyQuestions = AcademyQuestion::query()->count();
        $academyJobs = AcademyAiGenerationJob::query()->count();

        [$admin, $exam, $job, $res] = $this->generateCitizenshipDraft();

        $this->assertNotSame('LMS generation job accepted as draft factory.', $res->json('message'));
        $this->assertNotNull($res->json('job_id'));
        $this->assertDatabaseHas('lms_ai_generation_jobs', [
            'id' => $job->id,
            'exam_id' => $exam->id,
            'generation_profile' => 'citizenship_exam_prep',
            'product_domain' => 'client_lms',
        ], 'lms');
        $this->assertSame($academyJobs, AcademyAiGenerationJob::query()->count());

        $job->refresh();
        $this->assertSame('draft_ready', $job->status);
        $this->assertSame(10, (int) $job->request_json['independent_count']);
        $this->assertSame(1, (int) $job->request_json['module_count']);
        $this->assertSame(2, (int) $job->request_json['lesson_count']);
        $this->assertSame(0, (int) $job->request_json['case_count']);
        $this->assertFalse((bool) $job->request_json['generate_cases']);

        $course = LmsCourse::query()->findOrFail($job->course_id);
        $this->assertFalse((bool) $course->is_published);
        $this->assertSame('content_review', $course->review_status);
        $this->assertSame($exam->id, (int) $course->exam_id);
        $this->assertSame(1, $course->modules()->count());
        $this->assertSame(2, LmsLesson::query()->whereIn('module_id', $course->modules()->pluck('id'))->count());

        $questions = LmsExamQuestion::query()->where('exam_id', $exam->id)->where('generation_job_id', $job->id)->get();
        $this->assertCount(10, $questions);
        $this->assertTrue($questions->every(fn (LmsExamQuestion $q) => $q->status === 'draft' && (int) $q->exam_id === (int) $exam->id));

        $pivots = LmsCourseQuestion::query()->where('course_id', $course->id)->get();
        $this->assertCount(10, $pivots);
        $this->assertTrue($pivots->every(fn (LmsCourseQuestion $row) => $row->practice_eligible && $row->mock_eligible));

        $template = LmsExamTemplate::query()->where('generation_job_id', $job->id)->first();
        $this->assertNotNull($template);
        $this->assertSame($exam->id, (int) $template->exam_id);
        $this->assertSame($course->id, (int) $template->course_id);
        $this->assertSame('random_pool', $template->selection_mode);
        $this->assertSame('draft', $template->status);
        $this->assertSame(10, (int) $template->total_questions);
        $this->assertTrue((bool) $template->allow_answer_review_after_submit);

        $this->assertSame($academyCourses, AcademyCourse::query()->count());
        $this->assertSame($academyModules, AcademyModule::query()->count());
        $this->assertSame($academyLessons, AcademyLesson::query()->count());
        $this->assertSame($academyQuestions, AcademyQuestion::query()->count());

        $fake = app(FakeAcademyGenerationProvider::class);
        $joined = implode("\n", $fake->capturedSystems);
        $this->assertStringContainsString('citizenship_exam_prep', $joined);
        $this->assertStringContainsString('You are a Client LMS authoring assistant', $joined);
        $this->assertStringNotContainsString('You are an RCIC Academy authoring assistant', $joined);
        $this->assertStringNotContainsString(AcademyAiPromptCatalog::system('independent_mcq'), $joined);
        $this->assertStringContainsString('citizenship_exam_prep', LmsAiPromptCatalog::system('independent_mcq', 'citizenship_exam_prep'));
        $this->assertStringNotContainsString('You are an RCIC Academy authoring assistant', LmsAiPromptCatalog::system('course_blueprint', 'citizenship_exam_prep'));
    }

    public function test_rcic_profile_cannot_target_lms_exams(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $exam = $this->postJson('/api/v1/admin/learning/exams?product_domain=client_lms', [
            'name' => 'Wrong domain exam',
            'key' => 'lms_rcic_'.uniqid(),
            'generation_profile' => 'rcic_exam_prep',
        ])->assertCreated()->json('exam');

        $this->postJson('/api/v1/admin/learning/exams/'.$exam['id'].'/generate-course?product_domain=client_lms')
            ->assertStatus(422)
            ->assertJsonPath('code', 'profile_domain_mismatch');
        $this->assertSame(0, LmsAiGenerationJob::query()->count());
    }

    public function test_citizenship_profile_cannot_target_academy_exams(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $exam = $this->postJson('/api/v1/admin/learning/exams', [
            'name' => 'Citizenship on Academy',
            'key' => 'acad_cit_'.uniqid(),
            'generation_profile' => 'citizenship_exam_prep',
        ])->assertCreated()->json('exam');

        $this->postJson('/api/v1/admin/learning/exams/'.$exam['id'].'/generate-course')
            ->assertStatus(422)
            ->assertJsonPath('code', 'profile_domain_mismatch');
        $this->assertSame(0, AcademyAiGenerationJob::query()->where('generation_profile', 'citizenship_exam_prep')->count());
    }

    public function test_lms_generation_requires_approved_evidence_pack(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $exam = $this->postJson('/api/v1/admin/learning/exams?product_domain=client_lms', [
            'name' => 'Canadian Citizenship Test',
            'key' => 'cit_pack_'.uniqid(),
            'generation_profile' => 'citizenship_exam_prep',
        ])->assertCreated()->json('exam');

        $this->postJson('/api/v1/admin/learning/exams/'.$exam['id'].'/generate-course?product_domain=client_lms')
            ->assertStatus(422)
            ->assertJsonPath('code', 'minimum_evidence_missing');
        $this->assertSame(0, LmsAiGenerationJob::query()->count());
    }

    public function test_blocking_evidence_conflict_rejects_generation(): void
    {
        [$admin, $exam] = $this->readyCitizenshipExam(true);
        Sanctum::actingAs($admin);
        $pack = app(ExamEvidencePackService::class)->ensurePack('client_lms', $exam->id);
        app(ExamEvidencePackService::class)->recordConflict($pack, 'duration_minutes', 30, 45);

        $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/generate-course?product_domain=client_lms")
            ->assertStatus(422)
            ->assertJsonPath('code', 'exam_source_conflict');
        $this->assertSame(0, LmsAiGenerationJob::query()->count());
    }

    public function test_generation_retry_does_not_duplicate_imported_data(): void
    {
        [, , $job] = $this->generateCitizenshipDraft();
        $courseCount = LmsCourse::query()->where('generation_job_id', $job->id)->count();
        $moduleCount = LmsModule::query()->count();
        $lessonCount = LmsLesson::query()->count();
        $questionCount = LmsExamQuestion::query()->where('generation_job_id', $job->id)->count();
        $pivotCount = LmsCourseQuestion::query()->count();
        $templateCount = LmsExamTemplate::query()->where('generation_job_id', $job->id)->count();

        $this->postJson("/api/v1/admin/learning/lms-ai-jobs/{$job->id}/retry")->assertOk();

        $this->assertSame($courseCount, LmsCourse::query()->where('generation_job_id', $job->id)->count());
        $this->assertSame($moduleCount, LmsModule::query()->count());
        $this->assertSame($lessonCount, LmsLesson::query()->count());
        $this->assertSame($questionCount, LmsExamQuestion::query()->where('generation_job_id', $job->id)->count());
        $this->assertSame($pivotCount, LmsCourseQuestion::query()->count());
        $this->assertSame($templateCount, LmsExamTemplate::query()->where('generation_job_id', $job->id)->count());
        $this->assertSame('draft_ready', $job->fresh()->status);
        $this->assertFalse((bool) LmsCourse::query()->where('generation_job_id', $job->id)->value('is_published'));
    }

    public function test_ai_cannot_publish_lms_content(): void
    {
        [, , $job] = $this->generateCitizenshipDraft();
        $this->postJson("/api/v1/admin/learning/lms-ai-jobs/{$job->id}/publish")
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'AI cannot approve or publish Client LMS content.']);
        $this->assertFalse((bool) LmsCourse::query()->find($job->course_id)?->is_published);
        $this->assertSame('draft', LmsExamTemplate::query()->where('generation_job_id', $job->id)->value('status'));
    }

    public function test_french_generation_requires_language_review(): void
    {
        [, , $job] = $this->generateCitizenshipDraft(['content_language' => 'fr']);
        $course = LmsCourse::query()->findOrFail($job->course_id);
        $this->assertSame('fr', $course->content_language);
        $this->assertSame('language_review', $course->review_status);
        $this->assertFalse((bool) $course->is_published);
        $this->assertNotSame('published', $course->review_status);
    }

    public function test_legacy_lms_assigned_course_flow_remains_green(): void
    {
        $client = User::factory()->create();
        $client->assignRole('client');
        $category = LmsCategory::query()->create(['name' => 'Assigned', 'slug' => 'assigned-cit', 'is_active' => true]);
        $course = LmsCourse::query()->create([
            'category_id' => $category->id,
            'title' => 'Assigned Citizenship Prep',
            'slug' => 'assigned-cit-prep',
            'is_published' => true,
            'access_mode' => 'self_purchase',
            'content_language' => 'en',
        ]);
        LmsCourseAssignment::query()->create([
            'course_id' => $course->id,
            'client_user_id' => $client->id,
            'assigned_by_user_id' => $client->id,
            'status' => 'assigned',
            'source' => 'self_purchase',
            'assigned_at' => now(),
            'ends_at' => now()->addMonths(3),
        ]);
        Sanctum::actingAs($client);
        $catalog = collect($this->getJson('/api/v1/client/lms/catalog')->assertOk()->json('data'))->pluck('title')->all();
        $this->assertContains('Assigned Citizenship Prep', $catalog);
        $mine = collect($this->getJson('/api/v1/client/lms/courses')->assertOk()->json('data'))->pluck('course.title')->all();
        $this->assertContains('Assigned Citizenship Prep', $mine);
    }

    public function test_academy_ai_rcic_prompt_catalog_is_unchanged(): void
    {
        $system = AcademyAiPromptCatalog::system('independent_mcq');
        $this->assertStringContainsString('You are an RCIC Academy authoring assistant', $system);
        $this->assertStringNotContainsString('citizenship_exam_prep', $system);
        $lms = LmsAiPromptCatalog::system('independent_mcq', 'citizenship_exam_prep');
        $this->assertStringContainsString('You are a Client LMS authoring assistant', $lms);
        $this->assertStringContainsString('citizenship_exam_prep', $lms);
        $this->assertStringNotContainsString('You are an RCIC Academy authoring assistant', $lms);
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array{0:User,1:LmsExam,2:LmsAiGenerationJob,3:\Illuminate\Testing\TestResponse}
     */
    private function generateCitizenshipDraft(array $extra = []): array
    {
        [$admin, $exam] = $this->readyCitizenshipExam(true);
        Sanctum::actingAs($admin);
        $payload = array_merge([
            'title' => 'Citizenship smoke draft',
            'generate_lessons' => true,
            'generate_independent_mcqs' => true,
            'generate_cases' => false,
            'generate_case_mcqs' => false,
            'independent_count' => 10,
            'case_based_count' => 0,
            'case_count' => 0,
            'module_count' => 1,
            'lesson_count' => 2,
            'mock_question_count' => 10,
            'include_mock' => true,
        ], $extra);
        $res = $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/generate-course?product_domain=client_lms", $payload)
            ->assertCreated();
        $this->assertNotSame('LMS generation job accepted as draft factory.', $res->json('message'));
        $jobId = (int) $res->json('job_id');
        $this->assertGreaterThan(0, $jobId);
        $this->assertSame('blueprint', $res->json('status'));
        $this->postJson("/api/v1/admin/learning/lms-ai-jobs/{$jobId}/approve-blueprint")->assertOk();
        $job = LmsAiGenerationJob::query()->findOrFail($jobId);

        return [$admin, $exam->fresh(), $job, $res];
    }

    /** @return array{0:User,1:LmsExam} */
    private function readyCitizenshipExam(bool $approved): array
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $res = $this->postJson('/api/v1/admin/learning/exams?product_domain=client_lms', [
            'name' => 'Canadian Citizenship Test',
            'key' => 'cit_test_'.uniqid(),
            'generation_profile' => 'citizenship_exam_prep',
            'exam_authority' => 'IRCC',
            'content_language' => 'en',
        ])->assertCreated();
        $exam = LmsExam::query()->findOrFail($res->json('exam.id'));
        $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/sources?product_domain=client_lms", [
            'source_type' => 'official_exam_page',
            'url' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship.html',
            'title' => 'Discover Canada',
            'authority' => 'IRCC',
            'verification_status' => 'verified',
            'licence_allows_reuse' => false,
            'excerpt' => 'Discover Canada explains the rights and responsibilities of citizenship including the right to vote.',
        ])->assertCreated();
        $exam->exam_format_json = [
            'total_questions' => 20,
            'duration_minutes' => 30,
            'topics' => ['rights_and_responsibilities'],
        ];
        $exam->structure_verification_status = 'verified';
        $exam->save();
        if ($approved) {
            $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/evidence-pack/approve?product_domain=client_lms")->assertOk();
        }

        return [$admin, $exam->fresh()];
    }

    private function adminUser(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin;
    }
}
