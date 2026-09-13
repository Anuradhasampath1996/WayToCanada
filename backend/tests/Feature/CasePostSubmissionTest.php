<?php

namespace Tests\Feature;

use App\Models\CaseHistoryEvent;
use App\Models\UserNotification;
use App\Support\CaseWorkflowStatus;
use Database\Seeders\PathwayRequirementRegistrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesGovernmentFormFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class CasePostSubmissionTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesLmsDatabase;
    use CreatesGovernmentFormFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wipeLmsTestDatabase();
        $this->seedGovernmentFormRoles();
        $this->seed(PathwayRequirementRegistrySeeder::class);
        Storage::fake('local');
    }

    public function test_submitted_case_can_take_request_record_decision_and_close(): void
    {
        ['consultant' => $consultant, 'clientUser' => $client, 'profile' => $profile, 'caseFile' => $caseFile]
            = $this->createConsultantWithClient();
        $this->markSubmitted($caseFile);

        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/government-requests", [
            'type' => 'biometrics',
            'due_at' => now()->addDays(14)->toDateString(),
            'notes' => 'Book biometrics appointment.',
        ])->assertCreated()
            ->assertJsonPath('request.type', 'biometrics')
            ->assertJsonPath('request.open', true);

        $this->assertSame(
            CaseWorkflowStatus::GOVERNMENT_REQUEST_RECEIVED,
            $caseFile->fresh()->workflow_status,
        );

        $this->assertNotNull(
            UserNotification::query()
                ->where('user_id', $client->id)
                ->where('dedupe_key', 'gov_request:'.($caseFile->governmentRequests()->first()->id))
                ->first()
        );

        $created = CaseHistoryEvent::query()
            ->where('case_file_id', $caseFile->id)
            ->where('event_type', 'government_request_created')
            ->first();
        $this->assertNotNull($created);

        $requestId = $caseFile->governmentRequests()->first()->id;

        Sanctum::actingAs($client);
        $clientShow = $this->getJson('/api/v1/client/post-submission')->assertOk();
        $this->assertSame('biometrics', $clientShow->json('government_requests.requests.0.type'));
        $this->assertNull($clientShow->json('closure'));

        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/government-requests/{$requestId}/in-progress")
            ->assertOk();
        $this->assertSame(
            CaseWorkflowStatus::RESPONSE_IN_PROGRESS,
            $caseFile->fresh()->workflow_status,
        );

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/government-requests/{$requestId}/answered", [
            'notes' => 'Biometrics completed.',
        ])->assertOk();

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/government-requests", [
            'type' => 'pfl',
            'due_at' => now()->addDays(7)->toDateString(),
            'notes' => 'Respond to procedural fairness letter.',
        ])->assertCreated();

        $pflId = $caseFile->governmentRequests()->where('type', 'pfl')->value('id');
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/government-requests/{$pflId}/answered", [
            'notes' => 'PFL response sent.',
        ])->assertOk();

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/closure/close")
            ->assertStatus(422);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/decision", [
            'decision_status' => 'approved',
            'decision_note' => 'Study permit approved.',
            'next_step_note' => 'Prepare landing documents.',
            'letter' => UploadedFile::fake()->create('decision.pdf', 40, 'application/pdf'),
        ])->assertOk()
            ->assertJsonPath('decision.decision_status', 'approved')
            ->assertJsonPath('decision.has_letter', true);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/decision", [
            'decision_status' => 'refused',
        ])->assertStatus(422);
        $this->assertSame('approved', $caseFile->fresh()->decision_status);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/closure/close")
            ->assertStatus(422);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/closure/checklist", [
            'items' => [
                'final_docs_saved' => true,
                'final_client_message' => true,
                'no_open_tasks' => true,
                'payments_noted' => true,
                'gov_requests_done' => true,
                'record_complete' => true,
            ],
        ])->assertOk()
            ->assertJsonPath('closure.can_close', true);

        $historyBeforeClose = CaseHistoryEvent::query()->where('case_file_id', $caseFile->id)->count();

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/closure/close", [
            'action' => 'close',
            'note' => 'Closed after approval.',
        ])->assertOk()
            ->assertJsonPath('closure.lifecycle_status', 'closed');

        $fresh = $caseFile->fresh();
        $this->assertSame('closed', $fresh->lifecycle_status);
        $this->assertSame(CaseWorkflowStatus::CASE_CLOSED, $fresh->workflow_status);
        $this->assertSame('approved', $fresh->decision_status);
        $this->assertSame(
            $historyBeforeClose + 1,
            CaseHistoryEvent::query()->where('case_file_id', $caseFile->id)->count(),
        );

        $decisionEvent = CaseHistoryEvent::query()
            ->where('case_file_id', $caseFile->id)
            ->where('event_type', 'decision_recorded')
            ->first();
        $this->expectException(\LogicException::class);
        $decisionEvent->update(['title' => 'tampered']);
    }

    public function test_government_request_requires_submission_and_other_needs_label(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile]
            = $this->createConsultantWithClient();

        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/government-requests", [
            'type' => 'biometrics',
        ])->assertStatus(422);

        $this->markSubmitted($caseFile);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/government-requests", [
            'type' => 'other',
        ])->assertStatus(422);

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/government-requests", [
            'type' => 'other',
            'custom_label' => 'IRCC portal password reset',
            'due_at' => now()->addDays(3)->toDateString(),
        ])->assertCreated()
            ->assertJsonPath('request.label', 'IRCC portal password reset');
    }

    public function test_legacy_submitted_case_can_receive_request_and_due_date_is_on_calendar(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile]
            = $this->createConsultantWithClient();

        $caseFile->update([
            'status' => 'APPLICATION_SUBMITTED',
            'workflow_status' => null,
            'submitted_at' => now()->subMonths(2),
            'application_number' => 'LEGACY-1',
        ]);

        $due = now()->addDays(5)->toDateString();
        $this->actingAsConsultant($consultant);
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/government-requests", [
            'type' => 'medical',
            'due_at' => $due,
        ])->assertCreated();

        $calendar = $this->getJson('/api/v1/consultant/calendar?'.http_build_query([
            'from' => now()->toDateString(),
            'to' => now()->addDays(10)->toDateString(),
            'timezone' => 'America/Toronto',
        ]))->assertOk();

        $titles = collect($calendar->json('events'))->pluck('title')->implode(' ');
        $this->assertStringContainsString('Medical exam', $titles);
        $this->assertTrue(
            collect($calendar->json('events'))->contains(fn ($event) => ($event['source'] ?? null) === 'government_request')
        );
    }

    public function test_refresh_does_not_duplicate_answered_or_decision_history(): void
    {
        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile]
            = $this->createConsultantWithClient();
        $this->markSubmitted($caseFile);

        $this->actingAsConsultant($consultant);
        $created = $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/government-requests", [
            'type' => 'aor',
        ])->assertCreated();
        $requestId = $created->json('request.id');

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/government-requests/{$requestId}/answered")
            ->assertOk();
        $this->postJson("/api/v1/consultant/clients/{$profile->id}/case-file/government-requests/{$requestId}/answered")
            ->assertOk();

        $this->assertSame(
            1,
            CaseHistoryEvent::query()
                ->where('case_file_id', $caseFile->id)
                ->where('event_type', 'government_request_answered')
                ->count()
        );

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/case-file/post-submission")->assertOk();
        $this->getJson("/api/v1/consultant/clients/{$profile->id}/case-file/post-submission")->assertOk();

        $this->assertSame(
            1,
            CaseHistoryEvent::query()
                ->where('case_file_id', $caseFile->id)
                ->where('event_type', 'government_request_created')
                ->count()
        );
    }

    private function markSubmitted($caseFile): void
    {
        $caseFile->update([
            'status' => 'APPLICATION_SUBMITTED',
            'workflow_status' => CaseWorkflowStatus::SUBMITTED,
            'submitted_at' => now(),
            'application_number' => 'W555111222',
            'lifecycle_status' => 'active',
        ]);
    }
}
