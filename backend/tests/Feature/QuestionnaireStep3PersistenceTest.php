<?php

namespace Tests\Feature;

use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class QuestionnaireStep3PersistenceTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesLmsDatabase;

    protected bool $seed = true;

    protected string $seeder = RolesAndPermissionsSeeder::class;

    protected function beforeRefreshingDatabase(): void
    {
        $this->wipeLmsTestDatabase();
    }

    public function test_step3_data_is_not_persisted_before_fix_regression_documentation(): void
    {
        $user = User::factory()->create();
        $user->assignRole('client');
        Sanctum::actingAs($user);

        $payload = [
            'step1_data' => ['visaType' => 'pr'],
            'step3_data' => [
                'hasVisaRefusal' => 'yes',
                'hasCriminalRecord' => 'no',
                'hasMedicalCondition' => 'yes',
                'intlTestTaken' => 'yes',
            ],
        ];

        $this->putJson('/api/v1/questionnaire', $payload)->assertOk();

        $submission = QuestionnaireSubmission::where('user_id', $user->id)->firstOrFail();

        $this->assertNotNull($submission->step3_data);
        $this->assertSame('yes', $submission->step3_data['hasVisaRefusal'] ?? null);
        $this->assertSame('no', $submission->step3_data['hasCriminalRecord'] ?? null);
        $this->assertSame('yes', $submission->step3_data['hasMedicalCondition'] ?? null);
    }

    public function test_step3_data_survives_reload_via_get_endpoint(): void
    {
        $user = User::factory()->create();
        $user->assignRole('client');
        Sanctum::actingAs($user);

        $this->putJson('/api/v1/questionnaire', [
            'step3_data' => [
                'hasVisaRefusal' => 'yes',
                'fundsLkrRange' => '5000000-10000000',
            ],
        ])->assertOk();

        $response = $this->getJson('/api/v1/questionnaire');
        $response->assertOk();
        $this->assertSame('yes', $response->json('data.step3_data.hasVisaRefusal'));
        $this->assertSame('5000000-10000000', $response->json('data.step3_data.fundsLkrRange'));
    }

    public function test_legacy_accompanying_step3_still_readable_when_canonical_missing(): void
    {
        $user = User::factory()->create();
        $user->assignRole('client');

        QuestionnaireSubmission::create([
            'user_id' => $user->id,
            'accompanying_data' => [
                'step3' => ['hasVisaRefusal' => 'yes'],
            ],
            'is_submitted' => false,
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/v1/questionnaire')
            ->assertOk()
            ->assertJsonPath('data.accompanying_data.step3.hasVisaRefusal', 'yes');
    }
}
