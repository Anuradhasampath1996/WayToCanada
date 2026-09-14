<?php

namespace Tests\Feature\Academy;

use App\Models\Academy\AcademyCourse;
use App\Models\Academy\AcademyExamAttempt;
use App\Models\Academy\AcademyExamTemplate;
use App\Models\Academy\AcademyLearningTrack;
use App\Models\Academy\AcademyQuestion;
use App\Models\Academy\AcademyQuestionAttempt;
use App\Models\ConsultantWorkspaceMember;
use App\Models\ConsultantWorkspaceMemberPermission;
use App\Models\User;
use App\Services\Team\TeamWorkspaceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesSubscriptionFixtures;
use Tests\Concerns\RefreshesAcademyDatabase;
use Tests\TestCase;

class AcademyStaffAccessTest extends TestCase
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

    public function test_staff_without_academy_learn_is_blocked(): void
    {
        [$owner, $staff] = $this->ownerAndStaff(['dashboard.view' => true, 'lms.view' => true]);
        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/consultant/academy/dashboard')->assertForbidden();
        $this->assertTrue($staff->hasRole('staff'));
        $this->assertNotSame($owner->id, $staff->id);
    }

    public function test_staff_progress_is_separate_from_owner(): void
    {
        [$owner, $staff] = $this->ownerAndStaff(['dashboard.view' => true, 'academy.learn' => true]);
        $this->actingAsAdmin()->publishIndependentQuestion('Owner Q');
        Sanctum::actingAs($owner);
        $session = $this->postJson('/api/v1/consultant/academy/practice/sessions', ['count' => 1])->assertCreated();
        $question = $session->json('questions.0');
        $this->postJson('/api/v1/consultant/academy/practice/sessions/'.$session->json('session.id').'/answers', [
            'question_id' => $question['id'],
            'selected_option_id' => $question['options'][0]['id'],
        ])->assertOk();

        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/consultant/academy/analytics')->assertOk()
            ->assertJsonPath('total_attempted', 0);
        $this->assertSame(1, AcademyQuestionAttempt::query()->where('user_id', $owner->id)->count());
        $this->assertSame(0, AcademyQuestionAttempt::query()->where('user_id', $staff->id)->count());
    }

    public function test_lms_view_does_not_grant_academy(): void
    {
        [, $staff] = $this->ownerAndStaff(['lms.view' => true]);
        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/consultant/academy/courses')->assertForbidden();
    }

    /** @param  array<string, bool>  $permissions */
    private function ownerAndStaff(array $permissions): array
    {
        $owner = $this->makeConsultant();
        $this->makeSubscription($owner, $this->makePackage());
        $staff = User::factory()->create(['email_verified_at' => now()]);
        $staff->assignRole('staff');
        $workspace = app(TeamWorkspaceService::class)->ensureForOwner($owner);
        $member = ConsultantWorkspaceMember::query()->create([
            'workspace_id' => $workspace->id,
            'user_id' => $staff->id,
            'invited_by' => $owner->id,
            'access_scope' => ConsultantWorkspaceMember::SCOPE_ALL,
            'status' => ConsultantWorkspaceMember::STATUS_ACTIVE,
        ]);
        ConsultantWorkspaceMemberPermission::query()->create([
            'member_id' => $member->id,
            'permissions' => $permissions,
        ]);

        return [$owner, $staff];
    }

    private function actingAsAdmin(): self
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        return $this;
    }

    private function publishIndependentQuestion(string $text): int
    {
        $res = $this->postJson('/api/v1/admin/academy/questions', [
            'type' => 'independent_mcq',
            'question_text' => $text,
            'explanation' => 'Because the official source says so.',
            'options' => [
                ['option_text' => 'Correct', 'is_correct' => true],
                ['option_text' => 'Wrong', 'is_correct' => false, 'incorrect_explanation' => 'Not this one'],
            ],
        ])->assertCreated();
        $id = $res->json('question.id');
        $version = $res->json('question.versions.0.id');
        $this->postJson("/api/v1/admin/academy/questions/{$id}/versions/{$version}/transition", [
            'status' => 'published',
            'override' => true,
            'comment' => 'test publish',
        ])->assertOk();

        return $id;
    }
}
