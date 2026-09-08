<?php

namespace Tests\Unit\GovernmentForms;

use App\Services\GovernmentForms\Transformers\FieldTransformerRegistry;
use App\Services\GovernmentForms\XfaDatasetBuilder;
use App\Support\GovernmentForms\Imm0008MappingDefinitions;
use Tests\TestCase;

class Imm0008MappingDefinitionsTest extends TestCase
{
    public function test_c1_mappings_include_applicant_identity_and_split_dob(): void
    {
        $rows = Imm0008MappingDefinitions::all();
        $keys = array_column($rows, 0);

        $this->assertContains('applicant.personal.family_name', $keys);
        $this->assertContains('applicant.personal.given_names', $keys);
        $this->assertContains('applicant.contact.email', $keys);
        $this->assertContains('applicant.contact.phone', $keys);
        $this->assertContains('applicant.address.line1', $keys);
        $this->assertContains('applicant.family.spouse.family_name', $keys);
        $this->assertContains('applicant.national_id.number', $keys);
        $this->assertContains('applicant.education.level', $keys);
        $this->assertContains('applicant.work.intended_occupation', $keys);
        $this->assertContains('applicant.family.children.0.family_name', $keys);
        $this->assertContains('applicant.language.native', $keys);
        $this->assertContains('applicant.language.communicate', $keys);

        $dobPaths = array_values(array_map(
            fn (array $r) => $r[1],
            array_filter($rows, fn (array $r) => $r[0] === 'applicant.personal.date_of_birth'),
        ));
        $this->assertCount(3, $dobPaths);
        $this->assertTrue(str_contains(implode(' ', $dobPaths), 'DOBYYYY'));
        $this->assertTrue(str_contains(implode(' ', $dobPaths), 'DOBMM'));
        $this->assertTrue(str_contains(implode(' ', $dobPaths), 'DOBDD'));
    }

    public function test_date_part_transformers_and_skeleton_merge(): void
    {
        $registry = new FieldTransformerRegistry;
        $this->assertSame('1990', $registry->transform('date_yyyy', '1990-04-12'));
        $this->assertSame('04', $registry->transform('date_mm', '1990-04-12'));
        $this->assertSame('12', $registry->transform('date_dd', '1990-04-12'));
        $this->assertSame('1122223333', $registry->transform('uci', '11-2222-3333'));
        $this->assertSame('1122223333', $registry->transform('uci', '11 2222 3333'));

        $skeleton = dirname(base_path(), 1).'/form-processor-poc/fixtures/imm0008_datasets_skeleton.xml';
        $this->assertFileExists($skeleton);

        $fieldValues = [];
        foreach (Imm0008MappingDefinitions::all() as $row) {
            [$canonical, $path, , $transformer] = array_pad($row, 4, 'text');
            $raw = match (true) {
                str_contains($canonical, 'date_of_birth') => '1990-04-12',
                str_contains($canonical, 'email') => 'test@example.com',
                str_contains($canonical, 'family_name') => 'SAMPATH',
                str_contains($canonical, 'given_names') => 'ANURADHA',
                str_contains($canonical, 'uci') => '11-2222-3333',
                default => 'VALUE',
            };
            $fieldValues[$path] = (string) $registry->transform($transformer ?? 'text', $raw);
        }

        $xml = (new XfaDatasetBuilder)->build('form1', $fieldValues, $skeleton);
        $this->assertStringContainsString('<FamilyName>SAMPATH</FamilyName>', $xml);
        $this->assertStringContainsString('<GivenName>ANURADHA</GivenName>', $xml);
        $this->assertStringContainsString('<DOBYYYY>1990</DOBYYYY>', $xml);
        $this->assertStringContainsString('<Email>test@example.com</Email>', $xml);
        $this->assertStringContainsString('<UCI>1122223333</UCI>', $xml);
        $this->assertStringNotContainsString('<UCI>11-2222-3333</UCI>', $xml);
    }
}
