<?php

namespace Tests\Unit\GovernmentForms;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\User;
use App\Services\GovernmentForms\CanonicalDataResolver;
use App\Services\GovernmentForms\SourceDataHasher;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CanonicalDataResolverTest extends TestCase
{
    #[Test]
    public function it_uses_snapshot_when_application_info_reviewed(): void
    {
        $consultant = new User(['name' => 'RCIC Consultant', 'rcic_number' => 'R999']);
        $consultant->id = 1;

        $profile = new ClientProfile(['user_id' => 2]);
        $profile->setRelation('user', new User(['name' => 'Client']));

        $caseFile = new CaseFile([
            'application_info_reviewed_at' => now(),
            'questionnaire_snapshot'       => [
                'main_data'  => [
                    'passportFullName' => 'Snap Shot',
                    'passportNumber'   => 'XY9876543',
                    'dob'              => '1985-01-20',
                ],
                'step1_data' => ['email' => 'snap@example.com'],
                'spouse_data' => ['fullName' => 'Spouse Person', 'dob' => '1987-03-10'],
                'children_data' => [
                    ['fullName' => 'Child One', 'relationship' => 'son'],
                ],
            ],
            'questionnaire_snapshot_hash' => 'abc123',
        ]);
        $caseFile->id = 50;
        $caseFile->setRelation('clientProfile', $profile);
        $caseFile->setRelation('consultant', $consultant);

        $resolver = new CanonicalDataResolver(new SourceDataHasher());
        $dataset = $resolver->resolve($caseFile);

        $this->assertTrue($dataset->usesSnapshot);
        $this->assertSame('Snap', $dataset->get('applicant.personal.given_names'));
        $this->assertSame('Shot', $dataset->get('applicant.personal.family_name'));
        $this->assertSame('XY9876543', $dataset->get('applicant.passport.number'));
        $this->assertSame('snap@example.com', $dataset->get('applicant.contact.email'));
        $this->assertSame('Spouse', $dataset->get('applicant.family.spouse.given_names'));
        $this->assertSame('Child', $dataset->get('applicant.family.children.0.given_names'));
        $this->assertSame('R999', $dataset->get('representative.rcic_number'));
        $this->assertArrayHasKey('questionnaire_snapshot', $dataset->sources);
        $this->assertNotEmpty($dataset->sourceHash);
    }

    #[Test]
    public function it_does_not_include_pdf_field_paths_in_keys(): void
    {
        $caseFile = new CaseFile(['application_info_reviewed_at' => now()]);
        $caseFile->id = 1;
        $caseFile->questionnaire_snapshot = [
            'main_data'  => ['passportFullName' => 'Test User'],
            'step1_data' => [],
        ];
        $caseFile->setRelation('clientProfile', new ClientProfile());
        $caseFile->setRelation('consultant', null);

        $resolver = new CanonicalDataResolver(new SourceDataHasher());
        $dataset = $resolver->resolve($caseFile);

        foreach (array_keys($dataset->values) as $key) {
            $this->assertStringNotContainsString('IMM_', $key);
            $this->assertStringNotContainsString('[0]', $key);
        }
    }

    #[Test]
    public function it_maps_representative_from_consultant(): void
    {
        $consultant = new User([
            'name'         => 'John RCIC',
            'email'        => 'john@firm.com',
            'rcic_number'  => 'R123456789',
            'company_name' => 'Immigration Firm Ltd',
            'company_phone' => '+14165551234',
        ]);

        $caseFile = new CaseFile(['application_info_reviewed_at' => now()]);
        $caseFile->id = 1;
        $caseFile->questionnaire_snapshot = ['main_data' => [], 'step1_data' => []];
        $caseFile->setRelation('clientProfile', new ClientProfile());
        $caseFile->setRelation('consultant', $consultant);

        $resolver = new CanonicalDataResolver(new SourceDataHasher());
        $dataset = $resolver->resolve($caseFile);

        $this->assertSame('John', $dataset->get('representative.personal.given_names'));
        $this->assertSame('RCIC', $dataset->get('representative.personal.family_name'));
        $this->assertSame('R123456789', $dataset->get('representative.rcic_number'));
        $this->assertSame('Immigration Firm Ltd', $dataset->get('representative.firm_name'));
    }
}
