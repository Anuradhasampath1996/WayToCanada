<?php

namespace Tests\Concerns;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\GovernmentFormVersion;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Database\Seeders\GovernmentFormVersionSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Laravel\Sanctum\Sanctum;

trait CreatesGovernmentFormFixtures
{
    protected function seedGovernmentFormRoles(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    protected function seedGovernmentFormVersions(): void
    {
        $this->seed(GovernmentFormVersionSeeder::class);
    }

    protected function createConsultantWithClient(): array
    {
        $consultant = User::factory()->create([
            'name'         => 'Jane RCIC',
            'email'        => 'consultant-gf-'.uniqid().'@example.test',
            'rcic_number'  => 'R123456789',
            'company_name' => 'Test Immigration Firm',
        ]);
        $consultant->assignRole('rcic');

        $clientUser = User::factory()->create([
            'name'  => 'Synthetic Applicant',
            'email' => 'client-gf-'.uniqid().'@example.test',
        ]);
        $clientUser->assignRole('client');

        $profile = ClientProfile::create([
            'user_id'       => $clientUser->id,
            'consultant_id' => $consultant->id,
        ]);

        $caseFile = CaseFile::create([
            'client_profile_id' => $profile->id,
            'consultant_id'     => $consultant->id,
            'case_number'       => random_int(1000, 32000),
            'name'              => 'Government Forms Test Case',
            'status'            => 'active',
            'lifecycle_status'  => 'in_progress',
        ]);

        $profile->update(['active_case_file_id' => $caseFile->id]);

        QuestionnaireSubmission::create([
            'user_id'    => $clientUser->id,
            'main_data'  => [
                'passportFullName' => 'Synthetic Client',
                'dob'              => '1990-01-15',
            ],
            'step1_data' => ['email' => $clientUser->email],
            'is_submitted' => true,
            'submitted_at' => now(),
        ]);

        return compact('consultant', 'clientUser', 'profile', 'caseFile');
    }

    protected function actingAsConsultant(User $consultant): User
    {
        Sanctum::actingAs($consultant);

        return $consultant;
    }

    protected function ensureImm5476Template(): ?GovernmentFormVersion
    {
        $version = GovernmentFormVersion::where('form_code', 'IMM5476')->first();
        if (! $version) {
            return null;
        }

        $path = storage_path('app/private/'.$version->template_storage_path);
        if (! is_file($path) || hash_file('sha256', $path) !== $version->template_sha256) {
            $this->artisan('government-forms:fetch-official', ['form' => 'IMM5476']);
            $version->refresh();
        }

        return $version;
    }

    protected function ensureImm5406Template(): ?GovernmentFormVersion
    {
        $version = GovernmentFormVersion::where('form_code', 'IMM5406')->first();
        if (! $version) {
            return null;
        }

        $path = storage_path('app/private/'.$version->template_storage_path);
        if (! is_file($path) || hash_file('sha256', $path) !== $version->template_sha256) {
            $official = storage_path('app/private/government-forms-poc/templates/official/imm5406-official-4f544818e48b.pdf');
            if (is_file($official)) {
                \Illuminate\Support\Facades\File::ensureDirectoryExists(dirname($path));
                copy($official, $path);
            }
        }

        return $version;
    }

    protected function populateImm5406Questionnaire(User $clientUser, bool $married = false): void
    {
        QuestionnaireSubmission::where('user_id', $clientUser->id)->update([
            'main_data' => [
                'passportFullName' => 'Synthetic STAGEHTEST',
                'dob' => '1990-03-20',
                'birthCountry' => 'Sri Lanka',
                'addressLine1' => '123 Stage H Street',
                'city' => 'Toronto',
                'countryOfResidence' => 'Canada',
            ],
            'step1_data' => [
                'email' => $clientUser->email,
                'married' => $married ? 'yes' : 'no',
            ],
            'spouse_data' => $married ? [
                'fullName' => 'Spouse STAGEH',
                'dob' => '1992-07-07',
                'birthCountry' => 'Sri Lanka',
            ] : [],
            'children_data' => [[
                'fullName' => 'Child One STAGEH',
                'dob' => '2015-01-01',
                'relationship' => 'Child',
            ]],
            'accompanying_data' => [
                ['fullName' => 'Parent One STAGEH', 'dob' => '1960-02-02', 'relationship' => 'my_parent', 'nicBirthPlace' => 'Sri Lanka', 'nicAddress' => 'Colombo'],
                ['fullName' => 'Parent Two STAGEH', 'dob' => '1962-04-04', 'relationship' => 'my_parent', 'nicBirthPlace' => 'Sri Lanka', 'nicAddress' => 'Kandy'],
            ],
        ]);
    }
}
