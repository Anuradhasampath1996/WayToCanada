<?php

namespace Tests\Feature\TeamStaffAccess;

use App\Models\ClientProfile;
use App\Models\ConsultantWorkspaceInvitation;
use App\Models\ConsultantWorkspaceMember;
use App\Models\TeamAuditEvent;
use App\Models\User;
use App\Services\Team\TeamAccess;
use App\Services\Team\TeamInvitationService;
use App\Services\Team\TeamWorkspaceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesSubscriptionFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class TeamStaffAccessTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesLmsDatabase;
    use CreatesSubscriptionFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wipeLmsTestDatabase();
        $this->seedBillingRoles();
        Mail::fake();
        config(['queue.default' => 'sync']);
    }

    public function test_owner_can_create_invitation_and_token_is_hashed(): void
    {
        $owner = $this->subscribedOwner();

        Sanctum::actingAs($owner);
        $res = $this->postJson('/api/v1/consultant/team/invitations', $this->invitePayload())
            ->assertCreated();

        $invitation = ConsultantWorkspaceInvitation::query()->first();
        $this->assertNotNull($invitation);
        $this->assertSame(64, strlen($invitation->token_hash));
        $this->assertDatabaseMissing('consultant_workspace_invitations', ['token_hash' => $res->json('invitation.email')]);
        $this->assertSame('sent', $res->json('invitation.status'));
    }

    public function test_token_is_single_use_and_expired_invitation_is_rejected(): void
    {
        $owner = $this->subscribedOwner();
        $service = app(TeamInvitationService::class);
        $workspace = app(TeamWorkspaceService::class)->ensureForOwner($owner);
        $first = $service->invite($workspace, $owner, $this->invitePayload());

        $this->postJson('/api/v1/team/invitations/'.$first['token'].'/accept', [
            'password' => 'StaffPass1',
            'password_confirmation' => 'StaffPass1',
        ])->assertCreated();

        $this->postJson('/api/v1/team/invitations/'.$first['token'].'/accept', [
            'password' => 'StaffPass1',
            'password_confirmation' => 'StaffPass1',
        ])->assertStatus(410);

        $second = $service->invite($workspace, $owner, $this->invitePayload([
            'email' => 'expired-staff@example.test',
        ]));
        $second['invitation']->update(['expires_at' => now()->subDay()]);

        $this->postJson('/api/v1/team/invitations/'.$second['token'].'/accept', [
            'password' => 'StaffPass1',
            'password_confirmation' => 'StaffPass1',
        ])->assertStatus(410);
    }

    public function test_accept_creates_staff_user_and_active_membership(): void
    {
        $owner = $this->subscribedOwner();
        [$token] = $this->inviteStaff($owner);

        $res = $this->postJson('/api/v1/team/invitations/'.$token.'/accept', [
            'name' => 'Pat Staff',
            'password' => 'StaffPass1',
            'password_confirmation' => 'StaffPass1',
        ])->assertCreated();

        $staff = User::query()->where('email', 'pat.staff@example.test')->first();
        $this->assertNotNull($staff);
        $this->assertTrue($staff->hasRole('staff'));
        $this->assertFalse($staff->hasRole('rcic'));
        $this->assertNotSame($owner->id, $staff->id);
        $this->assertTrue(ConsultantWorkspaceMember::query()->where('user_id', $staff->id)->where('status', 'active')->exists());
        $this->assertNotEmpty($res->json('token'));
    }

    public function test_preset_and_custom_permissions_persist(): void
    {
        $owner = $this->subscribedOwner();
        [$token] = $this->inviteStaff($owner, [
            'preset_key' => 'assistant',
            'permissions' => [
                'clients.view' => true,
                'clients.edit' => false,
                'cases.view' => true,
                'team.manage' => true,
                'billing.view' => true,
            ],
        ]);

        $this->postJson('/api/v1/team/invitations/'.$token.'/accept', [
            'password' => 'StaffPass1',
            'password_confirmation' => 'StaffPass1',
        ])->assertCreated();

        $member = ConsultantWorkspaceMember::query()->with('permissionSet')->first();
        $this->assertTrue($member->permissionMap()['clients.view']);
        $this->assertArrayNotHasKey('clients.edit', $member->permissionMap());
        $this->assertArrayNotHasKey('team.manage', $member->permissionMap());
        $this->assertArrayNotHasKey('billing.view', $member->permissionMap());
        $this->assertSame('assistant', $member->preset_key);
    }

    public function test_existing_user_email_is_rejected_on_invite_and_accept(): void
    {
        $owner = $this->subscribedOwner();
        $existing = $this->makeConsultant();

        Sanctum::actingAs($owner);
        $this->postJson('/api/v1/consultant/team/invitations', $this->invitePayload([
            'email' => $existing->email,
        ]))->assertStatus(422);

        $client = User::factory()->create(['email' => 'already-client@example.test']);
        $client->assignRole('client');
        $this->postJson('/api/v1/consultant/team/invitations', $this->invitePayload([
            'email' => 'already-client@example.test',
        ]))->assertStatus(422);
    }

    public function test_staff_me_context_omits_owner_modules_and_hidden_apis_403(): void
    {
        [$owner, $staff] = $this->ownerAndStaff(['clients.view' => true, 'cases.view' => true]);

        Sanctum::actingAs($staff);
        $me = $this->getJson('/api/v1/me')->assertOk();
        $this->assertSame('staff', $me->json('team.actor_type'));
        $this->assertFalse((bool) $me->json('team.permissions.billing.view'));
        $this->assertFalse((bool) $me->json('team.permissions.team.manage'));

        $this->getJson('/api/v1/consultant/billing')->assertForbidden();
        $this->getJson('/api/v1/consultant/referral')->assertForbidden();
        $this->getJson('/api/v1/consultant/wallet')->assertForbidden();
        $this->postJson('/api/v1/consultant/withdrawals', [
            'amount' => 50,
            'payout_method' => 'etransfer',
        ])->assertForbidden();
        $this->getJson('/api/v1/consultant/team')->assertForbidden();
    }

    public function test_staff_can_view_scoped_clients_and_cannot_edit_when_off(): void
    {
        [$owner, $staff, $profile] = $this->ownerStaffAndClient([
            'clients.view' => true,
            'clients.edit' => false,
            'cases.view' => true,
        ], ConsultantWorkspaceMember::SCOPE_ALL);

        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/consultant/clients')->assertOk()->assertJsonPath('data.0.id', $profile->id);
        $this->getJson('/api/v1/consultant/clients/'.$profile->id)->assertOk();
        $this->putJson('/api/v1/consultant/clients/'.$profile->id, ['notes' => 'nope'])->assertForbidden();
        $this->deleteJson('/api/v1/consultant/clients/'.$profile->id)->assertForbidden();
        $this->patchJson('/api/v1/consultant/clients/'.$profile->id.'/toggle-status')->assertForbidden();
    }

    public function test_assigned_selected_and_all_scopes_and_unassign_removes_access(): void
    {
        $owner = $this->subscribedOwner();
        $package = $this->makePackage();
        $this->makeSubscription($owner, $package);

        $a = $this->makeClient($owner, 'A Client');
        $b = $this->makeClient($owner, 'B Client');
        $staff = $this->createStaffFor($owner, [
            'clients.view' => true,
            'cases.view' => true,
        ], ConsultantWorkspaceMember::SCOPE_ASSIGNED);
        $member = ConsultantWorkspaceMember::query()->where('user_id', $staff->id)->first();

        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/consultant/clients')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/consultant/clients/'.$a['profile']->id)->assertNotFound();

        Sanctum::actingAs($owner);
        $this->postJson('/api/v1/consultant/clients/'.$a['profile']->id.'/case-file/team', [
            'member_id' => $member->id,
        ])->assertCreated();

        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/consultant/clients')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/consultant/clients/'.$a['profile']->id)->assertOk();
        $this->getJson('/api/v1/consultant/clients/'.$b['profile']->id)->assertNotFound();

        $member->update([
            'access_scope' => ConsultantWorkspaceMember::SCOPE_SELECTED,
            'allowed_case_file_ids' => [$b['case']->id],
        ]);
        $this->getJson('/api/v1/consultant/clients/'.$a['profile']->id)->assertOk();
        $this->getJson('/api/v1/consultant/clients/'.$b['profile']->id)->assertOk();

        Sanctum::actingAs($owner);
        $this->deleteJson('/api/v1/consultant/clients/'.$a['profile']->id.'/case-file/team/'.$member->id)->assertOk();

        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/consultant/clients/'.$a['profile']->id)->assertNotFound();
        $this->getJson('/api/v1/consultant/clients/'.$b['profile']->id)->assertOk();

        $member->update([
            'access_scope' => ConsultantWorkspaceMember::SCOPE_ALL,
            'allowed_case_file_ids' => [],
        ]);
        $this->getJson('/api/v1/consultant/clients/'.$a['profile']->id)->assertOk();
        $this->getJson('/api/v1/consultant/clients/'.$b['profile']->id)->assertOk();
    }

    public function test_cross_workspace_idor_and_numeric_enumeration_are_blocked(): void
    {
        $ownerA = $this->subscribedOwner();
        $ownerB = $this->subscribedOwner('other-rcic@example.test');
        $this->makeSubscription($ownerB, $this->makePackage(['stripe_product_id' => 'prod_b', 'stripe_monthly_price_id' => 'price_b_m', 'stripe_yearly_price_id' => 'price_b_y']));
        $foreign = $this->makeClient($ownerB, 'Foreign');
        $staff = $this->createStaffFor($ownerA, [
            'clients.view' => true,
            'cases.view' => true,
        ], ConsultantWorkspaceMember::SCOPE_ALL);

        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/consultant/clients/'.$foreign['profile']->id)->assertNotFound();
        $this->getJson('/api/v1/consultant/clients/'.$foreign['profile']->id.'/case-file')->assertNotFound();
        $list = $this->getJson('/api/v1/consultant/clients')->assertOk();
        $ids = collect($list->json('data') ?? [])->pluck('id');
        $this->assertFalse($ids->contains($foreign['profile']->id));
    }

    public function test_permission_removal_deactivate_reactivate_and_revoke_sessions(): void
    {
        [$owner, $staff, $profile] = $this->ownerStaffAndClient([
            'clients.view' => true,
            'cases.view' => true,
        ], ConsultantWorkspaceMember::SCOPE_ALL);
        $member = ConsultantWorkspaceMember::query()->where('user_id', $staff->id)->first();

        Sanctum::actingAs($owner);
        $this->patchJson('/api/v1/consultant/team/members/'.$member->id.'/permissions', [
            'permissions' => ['cases.view' => true],
        ])->assertOk();

        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/consultant/clients/'.$profile->id)->assertForbidden();

        Sanctum::actingAs($owner);
        $this->patchJson('/api/v1/consultant/team/members/'.$member->id.'/permissions', [
            'permissions' => ['clients.view' => true, 'cases.view' => true],
        ])->assertOk();
        $this->postJson('/api/v1/consultant/team/members/'.$member->id.'/deactivate')->assertOk();

        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/consultant/clients/'.$profile->id)->assertNotFound();

        $staff->createToken('password-auth');
        $this->assertGreaterThan(0, $staff->tokens()->count());
        Sanctum::actingAs($owner);
        $this->postJson('/api/v1/consultant/team/members/'.$member->id.'/revoke-sessions')->assertOk();
        $this->assertSame(0, $staff->fresh()->tokens()->count());

        $this->postJson('/api/v1/consultant/team/members/'.$member->id.'/reactivate')->assertOk();
        $this->assertSame('active', $member->fresh()->status);
        $this->assertTrue($member->fresh()->permissionMap()['clients.view']);
    }

    public function test_staff_cannot_call_owner_only_journey_actions_and_owner_still_can(): void
    {
        [$owner, $staff, $profile] = $this->ownerStaffAndClient([
            'clients.view' => true,
            'cases.view' => true,
            'pathways.recommend' => true,
            'application.prepare' => true,
        ], ConsultantWorkspaceMember::SCOPE_ALL);

        Sanctum::actingAs($staff);
        $this->postJson('/api/v1/consultant/clients/'.$profile->id.'/case-file/profile-review')->assertForbidden();
        $this->patchJson('/api/v1/consultant/clients/'.$profile->id.'/questionnaire/verify', [
            'field_key' => 'dob',
            'verified' => true,
        ])->assertForbidden();
        $this->patchJson('/api/v1/consultant/clients/'.$profile->id.'/case-file/select-pathway', [
            'pathway_code' => 'study',
        ])->assertForbidden();
        $this->postJson('/api/v1/consultant/clients/'.$profile->id.'/case-file/final-review/ready-to-submit')->assertForbidden();
        $this->postJson('/api/v1/consultant/clients/'.$profile->id.'/case-file/submission', [
            'submission_date' => now()->toDateString(),
            'application_number' => 'X1',
        ])->assertForbidden();
        $this->postJson('/api/v1/consultant/clients/'.$profile->id.'/case-file/final-review/acknowledge')->assertForbidden();

        Sanctum::actingAs($owner);
        $this->getJson('/api/v1/consultant/clients/'.$profile->id)->assertOk();
        $this->getJson('/api/v1/consultant/clients/'.$profile->id.'/case-file')->assertOk();
    }

    public function test_team_audit_records_invite_and_permission_changes(): void
    {
        $owner = $this->subscribedOwner();
        Sanctum::actingAs($owner);
        $this->postJson('/api/v1/consultant/team/invitations', $this->invitePayload())->assertCreated();
        $this->assertTrue(TeamAuditEvent::query()->where('action', 'invite_sent')->exists());
    }

    public function test_staff_login_uses_own_account_and_records_last_login(): void
    {
        [$owner, $staff] = $this->ownerAndStaff(['clients.view' => true]);
        $staff->update(['password' => 'StaffPass1']);

        $res = $this->postJson('/api/v1/auth/login', [
            'email' => $staff->email,
            'password' => 'StaffPass1',
        ])->assertOk();

        $this->assertNotSame($owner->email, $res->json('user.email'));
        $this->assertContains('staff', $res->json('user.roles'));
        $this->assertNotNull(ConsultantWorkspaceMember::query()->where('user_id', $staff->id)->first()?->last_login_at);
    }

    public function test_owner_visible_query_unchanged_for_rcic(): void
    {
        $owner = $this->subscribedOwner();
        $client = $this->makeClient($owner, 'Owned');
        $other = $this->subscribedOwner('solo@example.test');
        $this->makeSubscription($other, $this->makePackage(['stripe_product_id' => 'prod_s', 'stripe_monthly_price_id' => 'price_s_m', 'stripe_yearly_price_id' => 'price_s_y']));
        $this->makeClient($other, 'Other');

        $query = app(TeamAccess::class)->visibleClientQuery($owner);
        $this->assertSame([$client['profile']->id], $query->pluck('id')->all());
    }

    /** @return array{0: User, 1: string} */
    private function inviteStaff(User $owner, array $overrides = []): array
    {
        $workspace = app(TeamWorkspaceService::class)->ensureForOwner($owner);
        $result = app(TeamInvitationService::class)->invite($workspace, $owner, $this->invitePayload($overrides));

        return [$result['token'], $result['invitation']];
    }

    /** @return array<string, mixed> */
    private function invitePayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Pat Staff',
            'email' => 'pat.staff@example.test',
            'job_title' => 'Case worker',
            'preset_key' => 'case_worker',
            'access_scope' => 'assigned_cases',
            'permissions' => [
                'clients.view' => true,
                'cases.view' => true,
            ],
        ], $overrides);
    }

    private function subscribedOwner(string $email = 'owner-rcic@example.test'): User
    {
        $owner = User::factory()->create([
            'email' => $email,
            'is_license_verified' => true,
            'email_verified_at' => now(),
            'company_name' => 'North Practice',
        ]);
        $owner->assignRole('rcic');
        $this->makeSubscription($owner, $this->makePackage([
            'stripe_product_id' => 'prod_'.md5($email),
            'stripe_monthly_price_id' => 'price_m_'.md5($email),
            'stripe_yearly_price_id' => 'price_y_'.md5($email),
        ]));

        return $owner;
    }

    /**
     * @param  array<string, bool>  $permissions
     * @return array{0: User, 1: User}
     */
    private function ownerAndStaff(array $permissions, string $scope = ConsultantWorkspaceMember::SCOPE_ALL): array
    {
        $owner = $this->subscribedOwner();
        $staff = $this->createStaffFor($owner, $permissions, $scope);

        return [$owner, $staff];
    }

    /**
     * @param  array<string, bool>  $permissions
     * @return array{0: User, 1: User, 2: ClientProfile}
     */
    private function ownerStaffAndClient(array $permissions, string $scope): array
    {
        $owner = $this->subscribedOwner();
        $client = $this->makeClient($owner, 'Scoped Client');
        $staff = $this->createStaffFor($owner, $permissions, $scope);

        return [$owner, $staff, $client['profile']];
    }

    /** @param  array<string, bool>  $permissions */
    private function createStaffFor(User $owner, array $permissions, string $scope): User
    {
        [$token] = $this->inviteStaff($owner, [
            'email' => 'staff-'.uniqid().'@example.test',
            'access_scope' => $scope,
            'permissions' => $permissions,
        ]);

        $this->postJson('/api/v1/team/invitations/'.$token.'/accept', [
            'password' => 'StaffPass1',
            'password_confirmation' => 'StaffPass1',
        ])->assertCreated();

        return User::query()->where('email', 'like', 'staff-%@example.test')->latest('id')->firstOrFail();
    }

    /** @return array{profile: ClientProfile, case: \App\Models\CaseFile} */
    private function makeClient(User $owner, string $name): array
    {
        $clientUser = User::factory()->create([
            'name' => $name,
            'consultant_id' => $owner->id,
        ]);
        $clientUser->assignRole('client');

        $profile = ClientProfile::query()->create([
            'user_id' => $clientUser->id,
            'consultant_id' => $owner->id,
        ]);

        $caseFile = \App\Models\CaseFile::query()->create([
            'client_profile_id' => $profile->id,
            'consultant_id' => $owner->id,
            'case_number' => random_int(1000, 32000),
            'name' => $name.' case',
            'status' => 'active',
            'lifecycle_status' => 'in_progress',
        ]);
        $profile->update(['active_case_file_id' => $caseFile->id]);

        return ['profile' => $profile->fresh(), 'case' => $caseFile->fresh()];
    }
}
