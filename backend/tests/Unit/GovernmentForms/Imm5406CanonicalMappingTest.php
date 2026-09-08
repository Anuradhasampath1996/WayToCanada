<?php

namespace Tests\Unit\GovernmentForms;

use App\Services\GovernmentForms\CanonicalDataResolver;
use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class Imm5406CanonicalMappingTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesLmsDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wipeLmsTestDatabase();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_it_maps_parents_from_accompanying_persons_and_children_by_index(): void
    {
        $consultant = User::factory()->create();
        $consultant->assignRole('rcic');
        $client = User::factory()->create(['email' => 'stageh.client@example.test']);
        $client->assignRole('client');

        $profile = ClientProfile::create([
            'user_id' => $client->id,
            'consultant_id' => $consultant->id,
        ]);

        $caseFile = CaseFile::create([
            'client_profile_id' => $profile->id,
            'consultant_id' => $consultant->id,
            'case_number' => 5406,
            'name' => 'Stage H',
            'status' => 'active',
            'lifecycle_status' => 'in_progress',
        ]);

        QuestionnaireSubmission::create([
            'user_id' => $client->id,
            'main_data' => [
                'passportFullName' => 'Synthetic STAGEHTEST',
                'dob' => '1990-03-20',
                'birthCountry' => 'Sri Lanka',
                'addressLine1' => '123 Stage H Street',
                'city' => 'Toronto',
                'countryOfResidence' => 'Canada',
            ],
            'step1_data' => [
                'email' => 'stageh.client@example.test',
                'married' => 'no',
            ],
            'children_data' => [[
                'fullName' => 'Child One STAGEH',
                'dob' => '2015-01-01',
            ]],
            'accompanying_data' => [
                ['fullName' => 'Parent One STAGEH', 'dob' => '1960-02-02', 'relationship' => 'my_parent', 'nicBirthPlace' => 'Sri Lanka'],
                ['fullName' => 'Parent Two STAGEH', 'dob' => '1962-04-04', 'relationship' => 'my_parent', 'nicBirthPlace' => 'Sri Lanka'],
                ['fullName' => 'Sibling STAGEH', 'dob' => '1988-05-05', 'relationship' => 'sibling', 'nicBirthPlace' => 'Sri Lanka'],
            ],
            'is_submitted' => true,
            'submitted_at' => now(),
        ]);

        $values = app(CanonicalDataResolver::class)->resolve($caseFile)->values;

        $this->assertSame('STAGEHTEST', $values['applicant.personal.family_name'] ?? null);
        $this->assertSame('One STAGEH', $values['applicant.family.parent1.family_name'] ?? null);
        $this->assertSame('Parent', $values['applicant.family.parent1.given_names'] ?? null);
        $this->assertSame('Two STAGEH', $values['applicant.family.parent2.family_name'] ?? null);
        $this->assertSame('Child', $values['applicant.family.children.0.given_names'] ?? null);
        $this->assertSame('Sibling', $values['applicant.family.siblings.0.given_names'] ?? null);
    }
}
