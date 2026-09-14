<?php

namespace Tests\Feature\Learning;

use App\Http\Controllers\StripeWebhookController;
use App\Models\Academy\AcademyAiGenerationJob;
use App\Models\Academy\AcademyCourse;
use App\Models\Academy\AcademyCourseVersion;
use App\Models\Academy\AcademyEntitlement;
use App\Models\Academy\AcademyExam;
use App\Models\Academy\AcademyExamTemplate;
use App\Models\Academy\AcademyQuestion;
use App\Models\Academy\AcademyQuestionOption;
use App\Models\Academy\AcademyQuestionVersion;
use App\Models\ConsultantSubscription;
use App\Models\Lms\LmsCategory;
use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsCourseAssignment;
use App\Models\Lms\LmsCourseQuestion;
use App\Models\Lms\LmsExam;
use App\Models\Lms\LmsExamAttempt;
use App\Models\Lms\LmsExamQuestion;
use App\Models\Lms\LmsExamQuestionOption;
use App\Models\Lms\LmsExamQuestionVersion;
use App\Models\Lms\LmsExamTemplate;
use App\Models\User;
use App\Services\Academy\AcademyExamService;
use App\Services\Academy\Ai\AcademyAiGuard;
use App\Services\Academy\Ai\AcademyAiOrchestrator;
use App\Services\Academy\Ai\AcademyAiValidationService;
use App\Services\Learning\ExamEvidencePackService;
use App\Services\Lms\LmsExamMasterService;
use App\Services\StripePaymentFulfillmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\Concerns\CreatesSubscriptionFixtures;
use Tests\Concerns\RefreshesAcademyDatabase;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class LearningMarketplaceTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesAcademyDatabase;
    use RefreshesLmsDatabase;
    use CreatesSubscriptionFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        $this->resetAcademySchema();
        $this->ensureLmsTestSchema();
        $this->seedBillingRoles();
        $this->fakeStripe();
        config([
            'academy_ai.research_driver' => 'fake',
            'academy_ai.generation_driver' => 'fake',
            'academy_ai.manus.enabled' => false,
            'academy_ai.manus.api_key' => null,
            'academy_ai.manus.poll_seconds' => 0,
            'academy_ai.manus.timeout_seconds' => 0,
            'academy_ai.openai.key' => '',
        ]);
    }

    public function test_patch_me_locale_persists(): void
    {
        $user = User::factory()->create(['locale' => 'en']);
        $user->assignRole('rcic');
        Sanctum::actingAs($user);
        $this->patchJson('/api/v1/me/locale', ['locale' => 'fr'])
            ->assertOk()
            ->assertJsonPath('locale', 'fr');
        $this->assertSame('fr', $user->fresh()->locale);
        $this->getJson('/api/v1/learning/i18n?locale=fr')
            ->assertOk()
            ->assertJsonPath('strings.verified', 'Vérifié');
    }

    public function test_evidence_pack_created_before_generation(): void
    {
        [$admin, $exam] = $this->adminExam();
        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/generate-course")
            ->assertStatus(422)
            ->assertJsonPath('code', 'minimum_evidence_missing');
        $this->assertDatabaseHas('academy_exam_evidence_packs', ['exam_id' => $exam->id], 'academy');
    }

    public function test_official_source_classified_from_authority_host(): void
    {
        [$admin, $exam] = $this->adminExam();
        Sanctum::actingAs($admin);
        $res = $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/sources", [
            'source_type' => 'official_exam_page',
            'url' => 'https://college-ic.ca/exams/irb',
            'title' => 'CICC IRB exam',
            'authority' => 'CICC',
            'verification_status' => 'verified',
            'licence_allows_reuse' => false,
        ]);
        $res->assertCreated();
        $this->assertTrue((bool) $res->json('item.is_official'));
    }

    public function test_unverified_past_paper_cannot_become_authoritative(): void
    {
        [$admin, $exam] = $this->adminExam();
        Sanctum::actingAs($admin);
        $res = $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/sources", [
            'source_type' => 'official_past_paper',
            'url' => 'https://random-dump.example/leaked.pdf',
            'suspected_leak' => true,
            'title' => 'Dump',
        ])->assertCreated();
        $id = $res->json('item.id');
        $this->assertSame('unverified_exam_material', $res->json('item.classification_flag'));
        $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/sources/{$id}/verify")
            ->assertStatus(422);
    }

    public function test_official_sample_may_be_analyzed(): void
    {
        $service = app(ExamEvidencePackService::class);
        [$admin, $exam] = $this->adminExam();
        Sanctum::actingAs($admin);
        $item = $service->ingestItem('rcic_academy', $exam->id, [
            'source_type' => 'official_sample_questions',
            'url' => 'https://college-ic.ca/sample',
            'title' => 'Sample',
            'verification_status' => 'verified',
            'licence_allows_reuse' => true,
            'excerpt' => 'Which division hears refugee claims?',
        ]);
        $meta = $service->analyzeOfficialSample($item, ['topic_frequency' => ['rpd' => 3]]);
        $this->assertSame(['topic_frequency' => ['rpd' => 3]], $meta);
        $this->assertNotNull($item->fresh()->content_hash);
    }

    public function test_source_snapshot_hash_stored(): void
    {
        $service = app(ExamEvidencePackService::class);
        [, $exam] = $this->adminExam();
        $item = $service->ingestItem('rcic_academy', $exam->id, [
            'source_type' => 'official_exam_page',
            'url' => 'https://college-ic.ca/page',
            'body' => 'Official handbook body text',
            'verification_status' => 'verified',
            'licence_allows_reuse' => true,
        ]);
        $this->assertSame(hash('sha256', 'Official handbook body text'), $item->content_hash);
        $this->assertTrue($item->full_file_stored);
    }

    public function test_conflicting_structure_blocks_generation(): void
    {
        [$admin, $exam] = $this->readyExam($approved = true);
        Sanctum::actingAs($admin);
        $pack = app(ExamEvidencePackService::class)->ensurePack('rcic_academy', $exam->id);
        app(ExamEvidencePackService::class)->recordConflict($pack, 'duration_minutes', 240, 180);
        $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/generate-course")
            ->assertStatus(422)
            ->assertJsonPath('code', 'exam_source_conflict');
    }

    public function test_newer_official_source_resolves_stale_conflict(): void
    {
        $service = app(ExamEvidencePackService::class);
        [, $exam] = $this->readyExam(true);
        $pack = $service->ensurePack('rcic_academy', $exam->id);
        $service->recordConflict($pack, 'duration_minutes', 240, 180);
        $newer = $service->ingestItem('rcic_academy', $exam->id, [
            'source_type' => 'official_exam_page',
            'url' => 'https://college-ic.ca/new',
            'verification_status' => 'verified',
            'version_label' => '2.0',
            'licence_allows_reuse' => false,
        ]);
        $service->resolveConflictWithNewerOfficial($pack->fresh(), $newer);
        $this->assertSame(0, $pack->fresh()->unresolved_conflict_count);
    }

    public function test_manus_research_does_not_alter_exam_master(): void
    {
        [$admin, $exam] = $this->adminExam();
        Sanctum::actingAs($admin);
        $name = $exam->name;
        $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/research", [
            'manus_research_json' => ['name' => 'Hacked', 'total_questions' => 10],
            'openai_verification_json' => ['total_questions' => 10],
        ])->assertOk();
        $this->assertSame($name, $exam->fresh()->name);
    }

    public function test_openai_cross_check_records_disagreement(): void
    {
        [$admin, $exam] = $this->adminExam();
        Sanctum::actingAs($admin);
        $res = $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/research", [
            'manus_research_json' => ['duration_minutes' => 240],
            'openai_verification_json' => ['duration_minutes' => 180],
        ])->assertOk();
        $this->assertTrue($res->json('comparison.disagreement'));
        $this->assertNotEquals(
            $res->json('pack.manus_research_json'),
            $res->json('pack.openai_verification_json')
        );
    }

    public function test_model_agreement_without_official_source_is_not_verified(): void
    {
        $service = app(ExamEvidencePackService::class);
        [, $exam] = $this->adminExam();
        $pack = $service->ensurePack('rcic_academy', $exam->id);
        $cmp = $service->compareResearch(
            ['duration_minutes' => 240],
            ['duration_minutes' => 240],
            $pack
        );
        $this->assertArrayHasKey('duration_minutes', $cmp['unverified_facts']);
        $this->assertSame('model_agreement_without_official_source', $cmp['unverified_facts']['duration_minutes']['reason']);
    }

    public function test_admin_entered_structure_is_admin_asserted_not_verified(): void
    {
        [$admin, $exam] = $this->adminExam();
        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/structure", [
            'exam_format_json' => ['total_questions' => 190, 'duration_minutes' => 240],
            'reason' => 'from memory of candidate guide',
        ])->assertOk()->assertJsonPath('exam.structure_verification_status', 'admin_asserted');
        $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/generate-course")
            ->assertStatus(422)
            ->assertJsonPath('code', 'minimum_evidence_missing');
    }

    public function test_blueprint_requires_verified_evidence_pack(): void
    {
        [, $exam] = $this->adminExam();
        $job = AcademyAiGenerationJob::query()->create([
            'type' => 'course',
            'status' => 'queued',
            'requested_by' => 1,
            'title' => 'Test',
            'exam_id' => $exam->id,
        ]);
        $this->expectException(\RuntimeException::class);
        app(AcademyAiOrchestrator::class)->blueprint($job, User::factory()->create());
    }

    public function test_lesson_and_mcq_provenance_stored(): void
    {
        [$admin, $exam] = $this->readyExam(true);
        Sanctum::actingAs($admin);
        $res = $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/questions", [
            'type' => 'independent_mcq',
            'question_text' => 'Which division hears inland refugee claims?',
            'options' => [
                ['option_text' => 'RPD', 'is_correct' => true],
                ['option_text' => 'IAD', 'is_correct' => false],
            ],
        ])->assertCreated();
        $version = AcademyQuestionVersion::query()->where('question_id', $res->json('question.id'))->first();
        $this->assertSame($exam->id, $version->provenance_json['exam_id']);
        $this->assertTrue($version->provenance_json['manual']);
    }

    public function test_validator_prompt_does_not_include_generated_answer(): void
    {
        $job = AcademyAiGenerationJob::query()->create([
            'type' => 'questions',
            'status' => 'queued',
            'requested_by' => 1,
            'title' => 'v',
        ]);
        $prompt = app(AcademyAiValidationService::class)->independentSolvePrompt($job, [
            'stem' => 'A question?',
            'options' => [
                ['key' => 'A', 'text' => 'One', 'is_correct' => true],
                ['key' => 'B', 'text' => 'Two', 'is_correct' => false],
            ],
        ]);
        $this->assertStringNotContainsString('is_correct', $prompt);
        $this->assertStringNotContainsString('already marked correct', str_replace('Do not assume any option is already marked correct.', '', $prompt));
    }

    public function test_low_exam_relevance_and_style_and_near_copy_flags(): void
    {
        $service = app(ExamEvidencePackService::class);
        $this->assertFalse($service->examRelevance(['ethics'], ['rpd', 'iad']));
        $this->assertTrue($service->nearCopy(
            'Which division hears the inland refugee claim of Mr Smith in 2024?',
            'Which division hears the inland refugee claim of Mr Smith in 2024?'
        ));
        [, $exam] = $this->readyExam(true);
        $job = AcademyAiGenerationJob::query()->create([
            'type' => 'questions',
            'status' => 'queued',
            'requested_by' => 1,
            'title' => 'v',
            'exam_id' => $exam->id,
            'evidence_pack_id' => $exam->latestEvidencePack->id,
        ]);
        $exam->exam_format_json = ['competencies' => ['rpd']];
        $exam->save();
        $pack = $exam->latestEvidencePack;
        $pack->pattern_metadata_json = ['dominant_style' => 'scenario'];
        $pack->save();
        $flags = [];
        app(AcademyAiValidationService::class)->applyExamPasses($job, [
            'competencies' => ['ethics'],
            'style_pattern_category' => 'recall',
            'stem' => 'Which division hears the inland refugee claim of Mr Smith in 2024?',
        ], $flags);
        $this->assertContains('low_exam_relevance', $flags);
        $this->assertContains('style_mismatch', $flags);
    }

    public function test_coverage_gap_and_insufficient_pool(): void
    {
        $service = app(ExamEvidencePackService::class);
        $coverage = $service->coverageReport(['a', 'b'], ['a'], ['t1', 't2'], ['t1'], ['s1'], ['s1']);
        $this->assertSame('coverage_gap', $coverage['flag']);
        $pool = $service->mockPoolSufficient(5, ['total' => 10], []);
        $this->assertSame('insufficient_question_pool', $pool['code']);
        $this->assertSame('Insufficient Question Pool', $pool['message']);
    }

    public function test_refresh_does_not_silently_overwrite_approved_exam_data(): void
    {
        $service = app(ExamEvidencePackService::class);
        [, $exam] = $this->readyExam(true);
        $pack = $service->ensurePack('rcic_academy', $exam->id);
        $result = $service->refreshDoesNotOverwriteApproved($pack, ['name' => 'New'], false);
        $this->assertSame([], $result['applied']);
        $this->assertContains('name', $result['blocked']);
    }

    public function test_admin_override_is_audited(): void
    {
        [$admin, $exam] = $this->readyExam(true);
        Sanctum::actingAs($admin);
        $gate = app(ExamEvidencePackService::class)->generationGate('rcic_academy', $exam->id, $admin, [
            'warning_code' => 'missing_samples',
            'override_reason' => 'samples not published yet',
            'include_mock' => false,
        ]);
        $this->assertTrue($gate['ok']);
        $this->assertDatabaseHas('academy_exam_generation_overrides', [
            'exam_id' => $exam->id,
            'warning_code' => 'missing_samples',
        ], 'academy');
    }

    public function test_ai_still_cannot_publish(): void
    {
        $this->expectException(\Throwable::class);
        AcademyAiGuard::denyPublish();
    }

    public function test_new_official_version_stales_pack_immediately(): void
    {
        $service = app(ExamEvidencePackService::class);
        [, $exam] = $this->readyExam(true);
        $pack = $service->ensurePack('rcic_academy', $exam->id);
        $pack->last_verified_at = now();
        $pack->save();
        $service->markNewOfficialVersion($pack);
        $this->assertSame('new_official_version', $pack->fresh()->stale_reason);
        $this->assertSame('outdated', $pack->fresh()->status);
    }

    public function test_source_hash_change_triggers_review(): void
    {
        $service = app(ExamEvidencePackService::class);
        [, $exam] = $this->readyExam(true);
        $item = $service->ingestItem('rcic_academy', $exam->id, [
            'source_type' => 'official_exam_page',
            'url' => 'https://college-ic.ca/h',
            'body' => 'old',
            'verification_status' => 'verified',
            'licence_allows_reuse' => true,
        ]);
        $service->markHashChanged($item, hash('sha256', 'new'));
        $this->assertSame('source_content_changed', $item->pack->fresh()->stale_reason);
    }

    public function test_profile_specific_next_review_at(): void
    {
        $rcic = app(ExamEvidencePackService::class)->nextReviewAt('rcic_exam_prep', '2026-01-01');
        $lang = app(ExamEvidencePackService::class)->nextReviewAt('language_exam_prep', '2026-01-01');
        $this->assertTrue($lang->greaterThan($rcic));
        $this->assertSame('2026-04-01', $rcic->toDateString());
    }

    public function test_robots_txt_alone_does_not_classify_reusable(): void
    {
        $status = app(ExamEvidencePackService::class)->classifyUsagePermission([
            'robots_txt_allowed' => true,
        ]);
        $this->assertSame('permission_unknown', $status);
    }

    public function test_restricted_material_is_not_fully_mirrored(): void
    {
        $service = app(ExamEvidencePackService::class);
        [, $exam] = $this->adminExam();
        $item = $service->ingestItem('rcic_academy', $exam->id, [
            'source_type' => 'official_past_paper',
            'url' => 'https://college-ic.ca/paper',
            'body' => str_repeat('confidential-looking text ', 40),
            'usage_permission_status' => 'permission_unknown',
            'verification_status' => 'verified',
        ]);
        $this->assertFalse($item->full_file_stored);
        $this->assertNotNull($item->excerpt);
    }

    public function test_critical_stale_evidence_blocks_generation(): void
    {
        [$admin, $exam] = $this->readyExam(true);
        Sanctum::actingAs($admin);
        $pack = app(ExamEvidencePackService::class)->ensurePack('rcic_academy', $exam->id);
        app(ExamEvidencePackService::class)->markNewOfficialVersion($pack);
        $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/generate-course")
            ->assertStatus(422)
            ->assertJsonPath('code', 'exam_reverification_required');
    }

    public function test_evidence_summary_reflects_states(): void
    {
        [$admin, $exam] = $this->readyExam(true);
        Sanctum::actingAs($admin);
        $summary = $this->getJson("/api/v1/admin/learning/exams/{$exam->id}")
            ->assertOk()
            ->json('evidence_summary');
        $this->assertSame('Verified', $summary['official_authority']);
        $this->assertSame('APPROVED', $summary['evidence_pack']);
        $this->assertFalse($summary['admin_asserted_only']);
    }

    public function test_exam_bank_is_exam_scoped_and_option_order_frozen(): void
    {
        $rcic = $this->subscribed();
        $exam = AcademyExam::query()->where('key', 'rcic_irb_specialization')->first();
        $this->assertNotNull($exam);
        $q1 = $this->publishedQuestion($exam->id, 'independent_mcq', 'Q1');
        $q2 = $this->publishedQuestion($exam->id, 'case_mcq', 'Q2');
        $template = AcademyExamTemplate::query()->create([
            'exam_id' => $exam->id,
            'name' => 'Scoped mock',
            'slug' => 'scoped-mock-1',
            'total_questions' => 2,
            'duration_minutes' => 10,
            'independent_count' => 1,
            'case_based_count' => 1,
            'selection_mode' => 'random_pool',
            'randomize_options' => true,
            'status' => 'published',
            'version_number' => 1,
        ]);
        $service = app(AcademyExamService::class);
        $attempt = $service->start($rcic, $template);
        $first = $attempt->question_set_json[0]['option_ids'];
        $show1 = $service->show($rcic, $attempt);
        $ids1 = collect($show1['questions'][0]['options'])->pluck('id')->all();
        $show2 = $service->show($rcic, $attempt->fresh());
        $ids2 = collect($show2['questions'][0]['options'])->pluck('id')->all();
        $this->assertSame($first, $ids1);
        $this->assertSame($ids1, $ids2);
        $this->assertEqualsCanonicalizing([$q1->id, $q2->id], collect($attempt->question_set_json)->pluck('question_id')->all());
    }

    public function test_learning_course_checkout_does_not_create_platform_subscription(): void
    {
        $rcic = $this->subscribed();
        $before = ConsultantSubscription::query()->count();
        $course = AcademyCourse::query()->create([
            'title' => 'Paid IRB',
            'slug' => 'paid-irb',
            'status' => 'published',
            'access_tier' => 'purchase',
            'price_cents' => 14900,
            'currency' => 'CAD',
            'commerce_confirmed' => true,
            'access_months' => 3,
        ]);
        $session = (object) [
            'id' => 'cs_test_learn',
            'mode' => 'payment',
            'payment_status' => 'paid',
            'status' => 'complete',
            'amount_total' => 14900,
            'currency' => 'cad',
            'payment_intent' => 'pi_test',
            'metadata' => [
                'type' => 'learning_course',
                'product_domain' => 'rcic_academy',
                'course_id' => (string) $course->id,
                'learner_user_id' => (string) $rcic->id,
                'access_months' => '3',
            ],
        ];
        app(StripePaymentFulfillmentService::class)->fulfillCheckoutSession($session);
        $this->assertSame($before, ConsultantSubscription::query()->count());
        $this->assertDatabaseHas('learning_course_payments', [
            'course_id' => $course->id,
            'learner_user_id' => $rcic->id,
            'status' => 'paid',
        ]);
    }

    public function test_academy_catalog_is_visible_without_subscription_as_buy_now(): void
    {
        $rcic = $this->makeConsultant();
        $course = $this->publishedAcademyCourse('IRB Catalog Course', ['access_tier' => 'purchase', 'price_cents' => 9900, 'commerce_confirmed' => true]);
        Sanctum::actingAs($rcic);
        $this->getJson('/api/v1/consultant/academy/courses')
            ->assertOk()
            ->assertJsonPath('data.0.status_cta', 'buy_now')
            ->assertJsonPath('data.0.course_id', $course->id);
        $this->assertNull($this->getJson('/api/v1/consultant/academy/courses')->json('data.0.ratings'));
    }

    public function test_lms_catalog_excludes_rcic_and_skips_pathway_gate(): void
    {
        $client = User::factory()->create();
        $client->assignRole('client');
        $category = LmsCategory::query()->create(['name' => 'Citizenship', 'slug' => 'citizenship', 'is_active' => true]);
        $cit = LmsCourse::query()->create([
            'category_id' => $category->id,
            'title' => 'Canadian Citizenship Test Preparation',
            'slug' => 'citizenship-prep',
            'is_published' => true,
            'access_mode' => 'self_purchase',
            'commerce_confirmed' => true,
            'price_cents' => 4900,
            'content_language' => 'en',
        ]);
        $rcicExam = LmsExam::query()->create([
            'key' => 'leaked_rcic',
            'slug' => 'leaked-rcic',
            'name' => 'IRB leak',
            'generation_profile' => 'rcic_exam_prep',
            'audience' => 'rcic',
            'product_domain' => 'rcic_academy',
            'status' => 'published',
        ]);
        LmsCourse::query()->create([
            'category_id' => $category->id,
            'title' => 'Should Not Appear',
            'slug' => 'rcic-leak',
            'is_published' => true,
            'access_mode' => 'self_purchase',
            'exam_id' => $rcicExam->id,
            'commerce_confirmed' => true,
            'price_cents' => 1,
        ]);
        Sanctum::actingAs($client);
        $res = $this->getJson('/api/v1/client/lms/catalog')->assertOk();
        $titles = collect($res->json('data'))->pluck('title')->all();
        $this->assertContains('Canadian Citizenship Test Preparation', $titles);
        $this->assertNotContains('Should Not Appear', $titles);
        $this->assertSame($cit->id, $res->json('data.0.course_id'));
    }

    public function test_webhook_routes_learning_course_payment_and_is_idempotent(): void
    {
        $rcic = $this->subscribed();
        $course = $this->publishedAcademyCourse('Webhook IRB', ['access_tier' => 'purchase', 'price_cents' => 14900, 'commerce_confirmed' => true]);
        $session = (object) [
            'id' => 'cs_webhook_learn',
            'mode' => 'payment',
            'payment_status' => 'paid',
            'status' => 'complete',
            'amount_total' => 14900,
            'currency' => 'cad',
            'payment_intent' => 'pi_webhook_learn',
            'metadata' => [
                'type' => 'learning_course',
                'product_domain' => 'rcic_academy',
                'course_id' => (string) $course->id,
                'learner_user_id' => (string) $rcic->id,
                'access_months' => '3',
            ],
        ];
        $this->seedStripeGateway();
        $controller = app(StripeWebhookController::class);
        $controller->processVerifiedEvent('evt_learn_1', 'checkout.session.completed', $session);
        $dup = $controller->processVerifiedEvent('evt_learn_1', 'checkout.session.completed', $session);
        $this->assertTrue($dup['duplicate'] ?? false);
        $this->assertSame(1, AcademyEntitlement::query()->where('course_id', $course->id)->where('user_id', $rcic->id)->count());
        $this->assertDatabaseHas('learning_course_payments', ['stripe_checkout_session_id' => 'cs_webhook_learn', 'status' => 'paid']);
        $this->assertSame(ConsultantSubscription::query()->where('user_id', $rcic->id)->count(), ConsultantSubscription::query()->where('user_id', $rcic->id)->count());
    }

    public function test_learning_refund_revokes_access_and_keeps_history_row(): void
    {
        $rcic = $this->subscribed();
        $course = $this->publishedAcademyCourse('Refund IRB', ['access_tier' => 'purchase', 'price_cents' => 14900, 'commerce_confirmed' => true]);
        $session = (object) [
            'id' => 'cs_refund_learn',
            'mode' => 'payment',
            'payment_status' => 'paid',
            'status' => 'complete',
            'amount_total' => 14900,
            'currency' => 'cad',
            'payment_intent' => 'pi_refund_learn',
            'metadata' => [
                'type' => 'learning_course',
                'product_domain' => 'rcic_academy',
                'course_id' => (string) $course->id,
                'learner_user_id' => (string) $rcic->id,
                'access_months' => '3',
            ],
        ];
        $fulfillment = app(StripePaymentFulfillmentService::class);
        $fulfillment->fulfillCheckoutSession($session);
        $this->assertTrue(AcademyEntitlement::query()->where('course_id', $course->id)->where('user_id', $rcic->id)->first()?->isCurrentlyActive());
        $fulfillment->revokeLearningCourseFromCharge((object) [
            'payment_intent' => 'pi_refund_learn',
            'metadata' => (object) ['checkout_session_id' => 'cs_refund_learn'],
        ]);
        $this->assertFalse((bool) AcademyEntitlement::query()->where('course_id', $course->id)->where('user_id', $rcic->id)->first()?->is_active);
        $this->assertDatabaseHas('learning_course_payments', ['stripe_checkout_session_id' => 'cs_refund_learn', 'status' => 'refunded']);
    }

    public function test_exam_result_dashboard_fields_after_submit(): void
    {
        $rcic = $this->subscribed();
        $exam = AcademyExam::query()->where('key', 'rcic_irb_specialization')->first();
        $this->publishedQuestion($exam->id, 'independent_mcq', 'Dash Q1');
        $this->publishedQuestion($exam->id, 'independent_mcq', 'Dash Q2');
        $template = AcademyExamTemplate::query()->create([
            'name' => 'Dashboard mock',
            'slug' => 'dash-mock',
            'total_questions' => 2,
            'duration_minutes' => 10,
            'independent_count' => 2,
            'case_based_count' => 0,
            'selection_mode' => 'random_pool',
            'status' => 'published',
            'version_number' => 1,
            'exam_id' => $exam->id,
        ]);
        $service = app(AcademyExamService::class);
        $attempt = $service->start($rcic, $template);
        $first = $attempt->question_set_json[0];
        $version = AcademyQuestionVersion::query()->with('options')->find($first['question_version_id']);
        $correct = $version->options->firstWhere('is_correct', true);
        $service->saveAnswer($rcic, $attempt, ['question_id' => $first['question_id'], 'selected_option_id' => $correct->id]);
        $view = $service->submit($rcic, $attempt->fresh());
        $this->assertNotNull($view['attempt']['score_percent']);
        $this->assertNotNull($view['attempt']['correct']);
        $this->assertNotNull($view['attempt']['incorrect']);
        $this->assertArrayHasKey('time_used_seconds', $view['attempt']);
        $this->assertArrayHasKey('attempt_number', $view['attempt']);
        $this->assertSame('submitted', $view['attempt']['submission_reason']);
        $this->assertNull($view['attempt']['topic_scores']);
    }

    public function test_lms_exam_master_freezes_option_order_and_hides_keys(): void
    {
        $client = User::factory()->create();
        $client->assignRole('client');
        $category = LmsCategory::query()->create(['name' => 'IELTS', 'slug' => 'ielts', 'is_active' => true]);
        $exam = LmsExam::query()->create([
            'key' => 'ielts_sm',
            'slug' => 'ielts-sm',
            'name' => 'IELTS',
            'generation_profile' => 'language_exam_prep',
            'audience' => 'client',
            'product_domain' => 'client_lms',
            'status' => 'published',
        ]);
        $course = LmsCourse::query()->create([
            'category_id' => $category->id,
            'title' => 'IELTS Prep',
            'slug' => 'ielts-prep',
            'is_published' => true,
            'access_mode' => 'self_purchase',
            'exam_id' => $exam->id,
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
        $q1 = $this->lmsPublishedQuestion($exam->id, 'L1');
        $q2 = $this->lmsPublishedQuestion($exam->id, 'L2');
        LmsCourseQuestion::query()->create(['course_id' => $course->id, 'question_id' => $q1->id, 'mock_eligible' => true]);
        LmsCourseQuestion::query()->create(['course_id' => $course->id, 'question_id' => $q2->id, 'mock_eligible' => true]);
        $template = LmsExamTemplate::query()->create([
            'exam_id' => $exam->id,
            'course_id' => $course->id,
            'name' => 'IELTS mini mock',
            'slug' => 'ielts-mini',
            'total_questions' => 2,
            'duration_minutes' => 10,
            'independent_count' => 2,
            'case_based_count' => 0,
            'selection_mode' => 'random_pool',
            'randomize_options' => true,
            'status' => 'published',
            'version_number' => 1,
        ]);
        $service = app(LmsExamMasterService::class);
        $attempt = $service->start($client, $template);
        $frozen = $attempt->question_set_json[0]['option_ids'];
        $show1 = $service->show($client, $attempt);
        $this->assertSame($frozen, collect($show1['questions'][0]['options'])->pluck('id')->all());
        $this->assertArrayNotHasKey('correct_option_id', $show1['questions'][0]);
        $this->assertCount(2, $show1['questions']);
        $this->assertSame(2, LmsExamQuestion::query()->count());
    }

    public function test_french_metadata_falls_back_to_english(): void
    {
        $card = \App\Support\Learning\LearningCatalogCard::fromDomain('rcic_academy', [
            'id' => 1,
            'title' => 'English title',
            'subtitle' => 'English sub',
            'translations' => ['fr' => ['title' => '']],
        ], ['id' => 9, 'name' => 'IRB', 'translations' => []], 'fr');
        $this->assertSame('English title', $card['title']);
    }

    public function test_random_pool_twenty_ten_attempt_matrix(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-14 12:00:00'));
        $rcic = $this->subscribed('rcic-matrix@example.test');
        $exam = AcademyExam::query()->where('key', 'rcic_irb_specialization')->firstOrFail();
        $ids = [];
        for ($i = 1; $i <= 20; $i++) {
            $ids[] = $this->publishedQuestion($exam->id, 'independent_mcq', 'Matrix Q'.$i)->id;
        }
        $this->assertCount(20, $ids);

        $template = AcademyExamTemplate::query()->create([
            'exam_id' => $exam->id,
            'name' => 'Matrix random mock',
            'slug' => 'matrix-random-mock',
            'total_questions' => 10,
            'duration_minutes' => 10,
            'independent_count' => 10,
            'case_based_count' => 0,
            'selection_mode' => 'random_pool',
            'randomize_options' => true,
            'allow_navigation' => true,
            'status' => 'published',
            'version_number' => 1,
        ]);
        $service = app(AcademyExamService::class);

        $attemptA = $service->start($rcic, $template);
        $setA = collect($attemptA->question_set_json)->pluck('question_id')->all();
        $optionsA = $attemptA->question_set_json[0]['option_ids'];
        $this->assertCount(10, $setA);
        $showA1 = $service->show($rcic, $attemptA);
        $showA2 = $service->show($rcic, $attemptA->fresh());
        $this->assertSame($setA, collect($showA1['questions'])->pluck('id')->all());
        $this->assertSame($setA, collect($showA2['questions'])->pluck('id')->all());
        $this->assertSame($optionsA, collect($showA1['questions'][0]['options'])->pluck('id')->all());
        $this->assertSame($optionsA, collect($showA2['questions'][0]['options'])->pluck('id')->all());
        $this->assertArrayNotHasKey('correct_option_id', $showA1['questions'][0]);
        $this->assertSame($attemptA->id, $service->start($rcic, $template)->id);
        $this->assertSame($attemptA->expires_at->toIso8601String(), $showA1['attempt']['expires_at']);

        foreach ($attemptA->question_set_json as $item) {
            $version = AcademyQuestionVersion::query()->with('options')->findOrFail($item['question_version_id']);
            $correct = $version->options->firstWhere('is_correct', true);
            $service->saveAnswer($rcic, $attemptA->fresh(), [
                'question_id' => $item['question_id'],
                'selected_option_id' => $correct->id,
            ]);
        }
        $viewA = $service->submit($rcic, $attemptA->fresh());
        $this->assertSame(100, $viewA['attempt']['score_percent']);
        $this->assertSame(10, $viewA['attempt']['correct']);
        $this->assertSame(0, $viewA['attempt']['incorrect']);
        $this->assertSame(0, $viewA['attempt']['unanswered']);
        try {
            $service->submit($rcic, $attemptA->fresh());
            $this->fail('Duplicate submit must be rejected');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
        }
        $this->assertSame(100, $attemptA->fresh()->score_percent);

        Carbon::setTestNow(Carbon::parse('2026-09-14 12:01:00'));
        $attemptB = $service->start($rcic, $template);
        $setB = collect($attemptB->question_set_json)->pluck('question_id')->all();
        $this->assertCount(10, $setB);
        $this->assertSame([], array_values(array_intersect($setA, $setB)), 'Attempt B should prefer the 10 unseen questions');
        $service->submit($rcic, $attemptB->fresh());

        Carbon::setTestNow(Carbon::parse('2026-09-14 12:02:00'));
        $attemptC = $service->start($rcic, $template);
        $setC = collect($attemptC->question_set_json)->pluck('question_id')->all();
        $this->assertEqualsCanonicalizing($setA, $setC, 'Attempt C should prefer A over more-recent B (weighting)');
        $service->submit($rcic, $attemptC->fresh());

        Carbon::setTestNow(Carbon::parse('2026-09-14 12:03:00'));
        $expired = $service->start($rcic, $template);
        $frozenExpiry = $expired->expires_at->toIso8601String();
        Carbon::setTestNow(Carbon::parse('2026-09-14 12:14:00'));
        $this->assertSame($frozenExpiry, $expired->fresh()->expires_at->toIso8601String());
        try {
            $service->saveAnswer($rcic, $expired->fresh(), [
                'question_id' => $expired->question_set_json[0]['question_id'],
                'selected_option_id' => $expired->question_set_json[0]['option_ids'][0],
            ]);
            $this->fail('Answers after expiry must be rejected');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
        }
        $this->assertSame('time_expired', $expired->fresh()->submission_reason);
        Carbon::setTestNow();
    }

    /** @return array{0:User,1:AcademyExam} */
    private function adminExam(): array
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);
        $res = $this->postJson('/api/v1/admin/learning/exams', [
            'name' => 'RCIC IRB',
            'key' => 'test_irb_'.uniqid(),
            'generation_profile' => 'rcic_exam_prep',
            'exam_authority' => 'CICC',
        ])->assertCreated();

        return [$admin, AcademyExam::query()->findOrFail($res->json('exam.id'))];
    }

    /** @return array{0:User,1:AcademyExam} */
    private function readyExam(bool $approved): array
    {
        [$admin, $exam] = $this->adminExam();
        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/sources", [
            'source_type' => 'official_exam_page',
            'url' => 'https://college-ic.ca/irb',
            'title' => 'Official IRB page',
            'authority' => 'CICC',
            'verification_status' => 'verified',
            'licence_allows_reuse' => false,
            'excerpt' => '190 questions 240 minutes',
        ])->assertCreated();
        $exam->exam_format_json = ['total_questions' => 190, 'duration_minutes' => 240];
        $exam->structure_verification_status = 'verified';
        $exam->save();
        if ($approved) {
            $this->postJson("/api/v1/admin/learning/exams/{$exam->id}/evidence-pack/approve")->assertOk();
        }

        return [$admin, $exam->fresh()];
    }

    private function publishedQuestion(int $examId, string $type, string $text): AcademyQuestion
    {
        $q = AcademyQuestion::query()->create([
            'exam_id' => $examId,
            'type' => $type,
            'status' => 'published',
            'mock_eligible' => true,
        ]);
        $v = AcademyQuestionVersion::query()->create([
            'question_id' => $q->id,
            'version_number' => 1,
            'question_text' => $text,
            'status' => 'published',
            'published_at' => now(),
        ]);
        foreach (['A' => true, 'B' => false, 'C' => false] as $key => $correct) {
            AcademyQuestionOption::query()->create([
                'question_version_id' => $v->id,
                'option_key' => $key,
                'option_text' => $text.' '.$key,
                'is_correct' => $correct,
                'sort_order' => ord($key),
            ]);
        }
        $q->update(['current_published_version_id' => $v->id]);

        return $q->fresh();
    }

    private function subscribed(string $email = 'rcic-learn@example.test'): User
    {
        $user = $this->makeConsultant();
        $user->email = $email;
        $user->save();
        $this->makeSubscription($user, $this->makePackage([
            'stripe_product_id' => 'prod_'.md5($email),
            'stripe_monthly_price_id' => 'pm_'.md5($email),
            'stripe_yearly_price_id' => 'py_'.md5($email),
        ]));

        return $user;
    }

    private function publishedAcademyCourse(string $title, array $extra = []): AcademyCourse
    {
        $course = AcademyCourse::query()->create(array_merge([
            'title' => $title,
            'slug' => \Illuminate\Support\Str::slug($title).'-'.uniqid(),
            'status' => 'published',
            'access_tier' => 'subscription',
            'content_language' => 'en',
        ], $extra));
        $version = AcademyCourseVersion::query()->create([
            'course_id' => $course->id,
            'version_number' => 1,
            'title' => $title,
            'status' => 'published',
        ]);
        $course->update(['current_published_version_id' => $version->id]);

        return $course->fresh();
    }

    private function lmsPublishedQuestion(int $examId, string $text): LmsExamQuestion
    {
        $q = LmsExamQuestion::query()->create([
            'exam_id' => $examId,
            'type' => 'independent_mcq',
            'status' => 'published',
            'mock_eligible' => true,
        ]);
        $v = LmsExamQuestionVersion::query()->create([
            'question_id' => $q->id,
            'version_number' => 1,
            'question_text' => $text,
            'difficulty' => 'medium',
            'status' => 'published',
            'published_at' => now(),
        ]);
        foreach (['A' => true, 'B' => false, 'C' => false] as $key => $correct) {
            LmsExamQuestionOption::query()->create([
                'question_version_id' => $v->id,
                'option_key' => $key,
                'option_text' => $text.' '.$key,
                'is_correct' => $correct,
                'sort_order' => ord($key),
            ]);
        }
        $q->update(['current_published_version_id' => $v->id]);

        return $q->fresh();
    }
}
