<?php

namespace Tests\Unit\GovernmentForms;

use App\Services\GovernmentForms\XfaDatasetBuilder;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class XfaDatasetBuilderTest extends TestCase
{
    #[Test]
    public function it_builds_nested_datasets_xml_from_som_paths(): void
    {
        $builder = new XfaDatasetBuilder();

        $xml = $builder->build('IMM_5476', [
            'IMM_5476[0].Page1[0].SectionA[0].familyName[0]' => 'POCTEST',
            'IMM_5476[0].Page1[0].SectionA[0].givenName[0]' => 'Synthetic Client',
        ]);

        $this->assertStringContainsString('<familyName>POCTEST</familyName>', $xml);
        $this->assertStringContainsString('<givenName>Synthetic Client</givenName>', $xml);
        $this->assertStringContainsString('<IMM_5476>', $xml);
        $this->assertStringNotContainsString('xfa:datasets', $xml);
        $this->assertStringNotContainsString('xfa:data', $xml);
    }

    #[Test]
    public function it_preserves_repeated_personal_data_and_child_occurrences(): void
    {
        $builder = new XfaDatasetBuilder();

        $xml = $builder->build('IMM_5406', [
            'IMM_5406[0].page1[0].SectionA[0].SectionAinfo[0].Applicant[0].PaddedEntry[0].PersonalData[0].Row[0].FamilyName[0]' => 'POCTEST',
            'IMM_5406[0].page1[0].SectionA[0].SectionAinfo[0].Applicant[0].PaddedEntry[0].PersonalData[0].Row[0].GivenNames[0]' => 'Synthetic',
            'IMM_5406[0].page1[0].SectionA[0].SectionAinfo[0].Applicant[0].PaddedEntry[0].PersonalData[1].Row[0].COB[0]' => 'Sri Lanka',
            'IMM_5406[0].page1[0].SectionA[0].SectionAinfo[0].Applicant[0].PaddedEntry[0].PersonalData[1].Row[0].Email[0]' => 'a@b.com',
            'IMM_5406[0].page1[0].SectionB[0].Child[0].Row[0].FamilyName[0]' => 'ChildOne',
            'IMM_5406[0].page1[0].SectionB[0].Child[1].Row[0].FamilyName[0]' => 'ChildTwo',
        ]);

        $this->assertSame(2, substr_count($xml, '<PersonalData>'));
        $this->assertSame(2, substr_count($xml, '<Child>'));
        $this->assertStringContainsString('<FamilyName>POCTEST</FamilyName>', $xml);
        $this->assertStringContainsString('<COB>Sri Lanka</COB>', $xml);
        $this->assertStringContainsString('<FamilyName>ChildOne</FamilyName>', $xml);
        $this->assertStringContainsString('<FamilyName>ChildTwo</FamilyName>', $xml);
    }

    #[Test]
    public function it_merges_values_into_imm5476_datasets_skeleton(): void
    {
        $builder = new XfaDatasetBuilder();
        $skeleton = dirname(base_path()).'/form-processor-poc/fixtures/imm5476_datasets_skeleton.xml';
        $this->assertFileExists($skeleton);

        $xml = $builder->build('IMM_5476', [
            'IMM_5476[0].Page1[0].SectionA[0].familyName[0]' => 'SAMPATH',
            'IMM_5476[0].Page1[0].SectionA[0].givenName[0]' => 'ANURADHA',
            'IMM_5476[0].Page1[0].RadioButtonList[0]' => '0',
            'IMM_5476[0].Page1[0].SectionB[0].question6[0].questionII[0].compensated[0]' => '0',
            'IMM_5476[0].Page1[0].SectionB[0].question6[0].questionII[0].ICCRCMember[0]' => 'R123456789',
        ], $skeleton);

        $this->assertStringContainsString('<familyName>SAMPATH</familyName>', $xml);
        $this->assertStringContainsString('<givenName>ANURADHA</givenName>', $xml);
        $this->assertStringContainsString('<RadioButtonList>0</RadioButtonList>', $xml);
        $this->assertStringContainsString('<compensated>0</compensated>', $xml);
        $this->assertStringContainsString('<ICCRCMember>R123456789</ICCRCMember>', $xml);
        // Skeleton structure retained for Adobe binding
        $this->assertStringContainsString('<sectionE>', $xml);
        $this->assertStringContainsString('<FormNumber>', $xml);
        $this->assertStringContainsString('<questionI>', $xml);
    }
}
