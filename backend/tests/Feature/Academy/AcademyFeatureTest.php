<?php

namespace Tests\Feature\Academy;

use App\Models\Academy\AcademyContentReview;
use App\Models\Academy\AcademyCourse;
use App\Models\Academy\AcademyEntitlement;
use App\Models\Academy\AcademyExamAttempt;
use App\Models\Academy\AcademyExamTemplate;
use App\Models\Academy\AcademyLearningTrack;
use App\Models\Academy\AcademyLegalSource;
use App\Models\Academy\AcademyOutdatedFlag;
use App\Models\Academy\AcademyQuestion;
use App\Models\Academy\AcademyQuestionAttempt;
use App\Models\Academy\AcademyQuestionVersion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesSubscriptionFixtures;
use Tests\Concerns\RefreshesAcademyDatabase;
use Tests\TestCase;

class AcademyFeatureTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesAcademyDatabase;
    use CreatesSubscriptionFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resetAcademySchema();
        $this->seedBillingRoles();
    }

    public function test_taxonomy_and_irb_template_are_bootstrapped_idempotently(): void
    {
        $this->assertSame(6, AcademyLearningTrack::query()->count());
        $this->assertTrue(AcademyLearningTrack::query()->where('key', 'irb_specialization')->exists());
        $template = AcademyExamTemplate::query()->where('slug', 'irb-specialization-readiness-mock')->first();
        $this->assertNotNull($template);
        $this->assertSame(190, $template->total_questions);
        $this->assertSame(240, $template->duration_minutes);
        $this->assertSame(95, $template->independent_count);
        $this->assertSame(95, $template->case_based_count);
        $this->assertTrue($template->randomize_options);
        $this->assertNull($template->max_attempts);
        $this->artisan('academy:bootstrap')->assertSuccessful();
        $this->assertSame(6, AcademyLearningTrack::query()->count());
        $this->assertSame(1, AcademyExamTemplate::query()->where('slug', 'irb-specialization-readiness-mock')->count());
    }

    public function test_client_is_blocked_from_academy(): void
    {
        $client = User::factory()->create();
        $client->assignRole('client');
        Sanctum::actingAs($client);
        $this->getJson('/api/v1/consultant/academy/dashboard')->assertNotFound();
    }

    public function test_consultant_without_subscription_is_blocked_unless_granted(): void
    {
        $rcic = $this->makeConsultant();
        Sanctum::actingAs($rcic);
        $this->getJson('/api/v1/consultant/academy/dashboard')->assertForbidden();

        AcademyEntitlement::query()->create([
            'user_id' => $rcic->id,
            'type' => 'admin_grant',
            'is_active' => true,
            'starts_at' => now(),
        ]);
        $this->getJson('/api/v1/consultant/academy/dashboard')->assertOk()
            ->assertJsonPath('readiness_label', 'Exam Readiness Score — not an official pass prediction');
    }

    public function test_draft_course_hidden_and_published_visible(): void
    {
        $rcic = $this->subscribed();
        $this->actingAsAdmin();
        $draft = $this->postJson('/api/v1/admin/academy/courses', ['title' => 'Draft IRB'])->assertCreated();
        Sanctum::actingAs($rcic);
        $this->getJson('/api/v1/consultant/academy/courses')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/consultant/academy/courses/'.$draft->json('course.id'))->assertNotFound();

        $this->publishCourse((int) $draft->json('course.id'), (int) $draft->json('course.versions.0.id'));
        Sanctum::actingAs($rcic);
        $this->getJson('/api/v1/consultant/academy/courses')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_grant_required_course_needs_explicit_grant(): void
    {
        $rcic = $this->subscribed();
        $this->actingAsAdmin();
        $created = $this->postJson('/api/v1/admin/academy/courses', [
            'title' => 'Grant only',
            'access_tier' => 'grant_required',
        ])->assertCreated();
        $this->publishCourse((int) $created->json('course.id'), (int) $created->json('course.versions.0.id'));
        Sanctum::actingAs($rcic);
        $this->getJson('/api/v1/consultant/academy/courses/'.$created->json('course.id'))->assertForbidden();
        $this->actingAsAdmin()->postJson('/api/v1/admin/academy/entitlements', [
            'user_id' => $rcic->id,
            'type' => 'course_grant',
            'course_id' => $created->json('course.id'),
        ])->assertCreated();
        Sanctum::actingAs($rcic);
        $this->getJson('/api/v1/consultant/academy/courses/'.$created->json('course.id'))->assertOk();
    }

    public function test_publish_requires_approval_unless_override_is_audited(): void
    {
        $this->actingAsAdmin();
        $q = $this->postJson('/api/v1/admin/academy/questions', $this->mcqPayload('Need review'))->assertCreated();
        $id = $q->json('question.id');
        $version = $q->json('question.versions.0.id');
        $this->postJson("/api/v1/admin/academy/questions/{$id}/versions/{$version}/transition", [
            'status' => 'published',
        ])->assertStatus(422);

        $this->postJson("/api/v1/admin/academy/questions/{$id}/versions/{$version}/transition", [
            'status' => 'content_review',
        ])->assertOk();
        $this->postJson("/api/v1/admin/academy/questions/{$id}/versions/{$version}/transition", [
            'status' => 'legal_review',
        ])->assertOk();
        $this->postJson("/api/v1/admin/academy/questions/{$id}/versions/{$version}/transition", [
            'status' => 'approved',
        ])->assertOk();
        $this->postJson("/api/v1/admin/academy/questions/{$id}/versions/{$version}/transition", [
            'status' => 'published',
        ])->assertOk();
        $this->assertSame('published', AcademyQuestion::query()->find($id)->status);

        $q2 = $this->postJson('/api/v1/admin/academy/questions', $this->mcqPayload('Override'))->assertCreated();
        $this->postJson('/api/v1/admin/academy/questions/'.$q2->json('question.id').'/versions/'.$q2->json('question.versions.0.id').'/transition', [
            'status' => 'published',
            'override' => true,
            'comment' => 'urgent',
        ])->assertOk();
        $this->assertTrue(AcademyContentReview::query()->where('comment', 'like', '%admin override%')->exists());
    }

    public function test_practice_hides_keys_until_answered_then_scores(): void
    {
        $rcic = $this->subscribed();
        $this->actingAsAdmin();
        $this->publishMcq('Independent one', 'independent_mcq');
        Sanctum::actingAs($rcic);
        $session = $this->postJson('/api/v1/consultant/academy/practice/sessions', [
            'count' => 1,
            'type' => 'independent_mcq',
            'explain_mode' => 'explain_immediately',
        ])->assertCreated();
        $question = $session->json('questions.0');
        $this->assertArrayNotHasKey('is_correct', $question);
        $this->assertArrayNotHasKey('correct_option_id', $question);
        $this->assertArrayNotHasKey('explanation', $question);
        $correct = $this->correctOptionId((int) $question['version_id']);
        $res = $this->postJson('/api/v1/consultant/academy/practice/sessions/'.$session->json('session.id').'/answers', [
            'question_id' => $question['id'],
            'selected_option_id' => $correct,
        ])->assertOk();
        $this->assertTrue($res->json('question.is_correct'));
        $this->assertNotEmpty($res->json('question.explanation'));
    }

    public function test_bookmarks_notes_and_incorrect_review_and_report(): void
    {
        $rcic = $this->subscribed();
        $this->actingAsAdmin();
        $qid = $this->publishMcq('Bookmark me', 'independent_mcq');
        Sanctum::actingAs($rcic);
        $this->postJson('/api/v1/consultant/academy/bookmarks', [
            'bookmarkable_type' => 'question',
            'bookmarkable_id' => $qid,
        ])->assertCreated();
        $this->getJson('/api/v1/consultant/academy/bookmarks')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson('/api/v1/consultant/academy/notes', [
            'notable_type' => 'question',
            'notable_id' => $qid,
            'body' => 'Review detention later',
        ])->assertCreated();
        $session = $this->postJson('/api/v1/consultant/academy/practice/sessions', ['count' => 1])->assertCreated();
        $q = $session->json('questions.0');
        $wrong = collect($q['options'])->first(fn ($o) => $o['id'] !== $this->correctOptionId((int) $q['version_id']));
        $this->postJson('/api/v1/consultant/academy/practice/sessions/'.$session->json('session.id').'/answers', [
            'question_id' => $q['id'],
            'selected_option_id' => $wrong['id'],
        ])->assertOk();
        $again = $this->postJson('/api/v1/consultant/academy/practice/sessions', [
            'count' => 1,
            'incorrect_only' => true,
        ])->assertCreated();
        $this->assertSame($q['id'], $again->json('questions.0.id'));
        $this->postJson('/api/v1/consultant/academy/questions/'.$qid.'/report', [
            'reason' => 'outdated_law',
            'comment' => 'Source looks old',
        ])->assertCreated();
    }

    public function test_mock_exam_hides_keys_scores_mix_and_preserves_versions(): void
    {
        $rcic = $this->subscribed();
        $this->actingAsAdmin();
        $this->publishMcq('I1', 'independent_mcq');
        $this->publishMcq('I2', 'independent_mcq');
        $caseId = $this->publishCaseWithQuestions();
        $template = $this->postJson('/api/v1/admin/academy/exam-templates', [
            'name' => 'Short mock',
            'total_questions' => 4,
            'duration_minutes' => 30,
            'independent_count' => 2,
            'case_based_count' => 2,
            'randomize_options' => true,
            'status' => 'published',
        ])->assertCreated()->json('template');

        Sanctum::actingAs($rcic);
        $started = $this->postJson('/api/v1/consultant/academy/exams/'.$template['id'].'/attempts')->assertCreated();
        $this->assertSame('in_progress', $started->json('attempt.status'));
        foreach ($started->json('questions') as $question) {
            $this->assertArrayNotHasKey('correct_option_id', $question);
            $this->assertArrayNotHasKey('explanation', $question);
            $this->assertArrayNotHasKey('is_correct', $question);
        }
        $types = collect($started->json('questions'))->pluck('type')->values();
        $this->assertSame(2, $types->filter(fn ($type) => $type === 'independent_mcq')->count());
        $this->assertSame(2, $types->filter(fn ($type) => $type === 'case_mcq')->count());

        $first = $started->json('questions.0');
        $this->putJson('/api/v1/consultant/academy/exams/attempts/'.$started->json('attempt.id').'/answers', [
            'question_id' => $first['id'],
            'selected_option_id' => $this->correctOptionId((int) $first['version_id']),
        ])->assertOk();

        $result = $this->postJson('/api/v1/consultant/academy/exams/attempts/'.$started->json('attempt.id').'/submit')->assertOk();
        $this->assertContains($result->json('attempt.status'), ['submitted', 'expired_submitted']);
        $this->assertNotNull($result->json('attempt.score_percent'));
        $this->assertNotNull($result->json('questions.0.explanation'));

        $versionId = $first['version_id'];
        $this->actingAsAdmin()->postJson('/api/v1/admin/academy/questions/'.$first['id'].'/draft')->assertCreated();
        $this->assertSame(
            $versionId,
            AcademyExamAttempt::query()->find($started->json('attempt.id'))->question_set_json[0]['question_version_id']
        );
        $this->assertSame(
            $versionId,
            AcademyQuestionAttempt::query()->where('exam_attempt_id', $started->json('attempt.id'))->where('question_id', $first['id'])->value('question_version_id')
        );

        Sanctum::actingAs($rcic);
        $this->postJson('/api/v1/consultant/academy/exams/attempts/'.$started->json('attempt.id').'/submit')->assertStatus(422);
        $this->assertNotNull($caseId);
    }

    public function test_expired_exam_rejects_answers_and_auto_finalizes(): void
    {
        $rcic = $this->subscribed();
        $this->actingAsAdmin();
        $this->publishMcq('Timer I', 'independent_mcq');
        $this->publishMcq('Timer C', 'case_mcq');
        $template = $this->postJson('/api/v1/admin/academy/exam-templates', [
            'name' => 'One minute',
            'total_questions' => 2,
            'duration_minutes' => 1,
            'independent_count' => 1,
            'case_based_count' => 1,
            'status' => 'published',
        ])->json('template');
        Sanctum::actingAs($rcic);
        $started = $this->postJson('/api/v1/consultant/academy/exams/'.$template['id'].'/attempts')->assertCreated();
        try {
            Carbon::setTestNow(now()->addMinutes(2));
            $q = $started->json('questions.0');
            $this->putJson('/api/v1/consultant/academy/exams/attempts/'.$started->json('attempt.id').'/answers', [
                'question_id' => $q['id'],
                'selected_option_id' => $q['options'][0]['id'],
            ])->assertStatus(422);
            $this->getJson('/api/v1/consultant/academy/exams/attempts/'.$started->json('attempt.id'))
                ->assertOk()
                ->assertJsonPath('attempt.status', 'expired_submitted');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_learner_cannot_read_another_learners_attempt(): void
    {
        $a = $this->subscribed('a@example.test');
        $b = $this->subscribed('b@example.test');
        $this->actingAsAdmin();
        $this->publishMcq('IDOR I', 'independent_mcq');
        $this->publishMcq('IDOR C', 'case_mcq');
        $template = $this->postJson('/api/v1/admin/academy/exam-templates', [
            'name' => 'IDOR',
            'total_questions' => 2,
            'duration_minutes' => 10,
            'independent_count' => 1,
            'case_based_count' => 1,
            'status' => 'published',
        ])->json('template');
        Sanctum::actingAs($a);
        $attempt = $this->postJson('/api/v1/consultant/academy/exams/'.$template['id'].'/attempts')->json('attempt.id');
        Sanctum::actingAs($b);
        $this->getJson('/api/v1/consultant/academy/exams/attempts/'.$attempt)->assertNotFound();
    }

    public function test_outdated_source_flags_linked_content_and_citations_show_after_score(): void
    {
        $rcic = $this->subscribed();
        $this->actingAsAdmin();
        $source = $this->postJson('/api/v1/admin/academy/sources', [
            'title' => 'IRPA excerpt',
            'source_url' => 'https://laws.justice.gc.ca/eng/acts/I-2.5/',
            'status' => 'published',
            'summary' => 'Study aid only.',
        ])->json('source');
        $this->postJson('/api/v1/admin/academy/sources/'.$source['id'].'/transition', [
            'status' => 'published',
            'override' => true,
        ]);
        $q = $this->publishMcq('Cited', 'independent_mcq');
        $version = AcademyQuestion::query()->find($q)->current_published_version_id;
        $this->postJson('/api/v1/admin/academy/source-links', [
            'legal_source_id' => $source['id'],
            'linkable_type' => 'question_version',
            'linkable_id' => $version,
            'section_label' => 's. 3',
        ])->assertCreated();
        $this->postJson('/api/v1/admin/academy/sources/'.$source['id'].'/outdated', [
            'reason' => 'source_changed',
        ])->assertOk();
        $this->assertTrue(AcademyOutdatedFlag::query()->where('linkable_id', $version)->exists());
        $this->assertSame('outdated', AcademyLegalSource::query()->find($source['id'])->status);

        Sanctum::actingAs($rcic);
        $session = $this->postJson('/api/v1/consultant/academy/practice/sessions', ['count' => 1])->assertCreated();
        $item = $session->json('questions.0');
        $res = $this->postJson('/api/v1/consultant/academy/practice/sessions/'.$session->json('session.id').'/answers', [
            'question_id' => $item['id'],
            'selected_option_id' => $this->correctOptionId((int) $item['version_id']),
        ])->assertOk();
        $this->assertNotEmpty($res->json('question.citations'));
    }

    public function test_course_version_pin_and_switch_and_planner_and_admin_analytics(): void
    {
        $rcic = $this->subscribed();
        $this->actingAsAdmin();
        $created = $this->postJson('/api/v1/admin/academy/courses', ['title' => 'Pinned'])->assertCreated();
        $courseId = $created->json('course.id');
        $v1 = $created->json('course.versions.0.id');
        $this->postJson('/api/v1/admin/academy/course-versions/'.$v1.'/modules', ['title' => 'M1'])->assertCreated();
        $this->publishCourse($courseId, $v1);
        Sanctum::actingAs($rcic);
        $this->getJson('/api/v1/consultant/academy/courses/'.$courseId)
            ->assertOk()
            ->assertJsonPath('version.id', $v1)
            ->assertJsonPath('can_switch_to_latest', false);

        $this->actingAsAdmin()->postJson('/api/v1/admin/academy/courses/'.$courseId.'/draft')->assertCreated();
        $draftVersion = AcademyCourse::query()->find($courseId)->versions()->where('status', 'draft')->latest('id')->first();
        $this->publishCourse($courseId, (int) $draftVersion->id);
        Sanctum::actingAs($rcic);
        $this->getJson('/api/v1/consultant/academy/courses/'.$courseId)
            ->assertOk()
            ->assertJsonPath('version.id', $v1)
            ->assertJsonPath('can_switch_to_latest', true);
        $this->postJson('/api/v1/consultant/academy/courses/'.$courseId.'/switch-latest')
            ->assertOk()
            ->assertJsonPath('progress.course_version_id', $draftVersion->id);

        $this->putJson('/api/v1/consultant/academy/planner', [
            'exam_date' => now()->addWeeks(8)->toDateString(),
            'weekly_hours' => 6,
        ])->assertOk()->assertJsonPath('plan.status', 'active');
        $this->getJson('/api/v1/consultant/academy/analytics')->assertOk();
        $this->actingAsAdmin()->getJson('/api/v1/admin/academy/analytics')->assertOk();
    }

    public function test_unpublished_source_hidden(): void
    {
        $rcic = $this->subscribed();
        $this->actingAsAdmin();
        $source = $this->postJson('/api/v1/admin/academy/sources', [
            'title' => 'Draft source',
            'status' => 'draft',
        ])->json('source');
        Sanctum::actingAs($rcic);
        $this->getJson('/api/v1/consultant/academy/sources/'.$source['id'])->assertNotFound();
    }

    private function subscribed(string $email = 'rcic-academy@example.test'): User
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

    private function actingAsAdmin(): self
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        return $this;
    }

    /** @return array<string, mixed> */
    private function mcqPayload(string $text, string $type = 'independent_mcq'): array
    {
        return [
            'type' => $type,
            'question_text' => $text,
            'explanation' => 'Grounded explanation.',
            'options' => [
                ['option_text' => 'Yes', 'is_correct' => true],
                ['option_text' => 'No', 'is_correct' => false, 'incorrect_explanation' => 'Incorrect because the source says otherwise.'],
            ],
        ];
    }

    private function publishMcq(string $text, string $type = 'independent_mcq'): int
    {
        $this->actingAsAdmin();
        $res = $this->postJson('/api/v1/admin/academy/questions', $this->mcqPayload($text, $type))->assertCreated();
        $this->postJson('/api/v1/admin/academy/questions/'.$res->json('question.id').'/versions/'.$res->json('question.versions.0.id').'/transition', [
            'status' => 'published',
            'override' => true,
        ])->assertOk();

        return (int) $res->json('question.id');
    }

    private function publishCourse(int $courseId, int $versionId): void
    {
        $this->actingAsAdmin();
        $this->postJson("/api/v1/admin/academy/courses/{$courseId}/versions/{$versionId}/transition", [
            'status' => 'published',
            'override' => true,
        ])->assertOk();
    }

    private function publishCaseWithQuestions(): int
    {
        $this->actingAsAdmin();
        $case = $this->postJson('/api/v1/admin/academy/cases', [
            'title' => 'Refugee claim case',
            'facts' => 'A claimant arrived and seeks protection.',
        ])->assertCreated();
        $versionId = $case->json('version.id');
        $this->postJson('/api/v1/admin/academy/case-versions/'.$versionId.'/exhibits', [
            'title' => 'BOC',
            'exhibit_type' => 'boc',
            'body_html' => '<p>BOC narrative</p>',
        ])->assertCreated();
        foreach (['Case Q1', 'Case Q2'] as $text) {
            $q = $this->postJson('/api/v1/admin/academy/questions', $this->mcqPayload($text, 'case_mcq') + [
                'case_version_id' => $versionId,
            ])->assertCreated();
            $this->postJson('/api/v1/admin/academy/questions/'.$q->json('question.id').'/versions/'.$q->json('question.versions.0.id').'/transition', [
                'status' => 'published',
                'override' => true,
            ])->assertOk();
            $this->postJson('/api/v1/admin/academy/case-versions/'.$versionId.'/questions', [
                'question_id' => $q->json('question.id'),
            ])->assertOk();
        }
        $this->postJson('/api/v1/admin/academy/cases/'.$case->json('case.id').'/versions/'.$versionId.'/transition', [
            'status' => 'published',
            'override' => true,
        ])->assertOk();

        return (int) $case->json('case.id');
    }

    private function correctOptionId(int $versionId): int
    {
        return (int) AcademyQuestionVersion::query()->findOrFail($versionId)->options()->where('is_correct', true)->value('id');
    }
}
