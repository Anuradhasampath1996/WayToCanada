<?php

namespace App\Support\GovernmentForms;

/**
 * IMM 5406 (05-2026) XFA SOM path definitions for DB seeding.
 *
 * @phpstan-type MappingRow array{0: string, 1: string, 2: bool}
 */
final class Imm5406MappingDefinitions
{
    private const ROOT = 'IMM_5406[0].page1[0]';

    private const SECTION_A = self::ROOT.'.SectionA[0].SectionAinfo[0]';

    private const SECTION_B = self::ROOT.'.SectionB[0].SectionBinfo[0]';

    private const SECTION_C = self::ROOT.'.SectionC[0].SectionCinfo[0]';

    /** @return list<MappingRow> */
    public static function all(): array
    {
        $mappings = [];

        $mappings = array_merge($mappings, self::sectionAPerson(
            self::SECTION_A.'.Applicant[0].PaddedEntry[0]',
            'applicant.personal',
            true,
        ));
        $mappings[] = ['applicant.contact.email', self::SECTION_A.'.Applicant[0].PaddedEntry[0].PersonalData[1].Row[0].Email[0]', true];

        $mappings = array_merge($mappings, self::sectionAPerson(
            self::SECTION_A.'.Spouse[0].PaddedEntry[0]',
            'applicant.family.spouse',
            false,
        ));

        $mappings = array_merge($mappings, self::sectionAPerson(
            self::SECTION_A.'.Parent1[0].PaddedEntry[0]',
            'applicant.family.parent1',
            true,
        ));

        $mappings = array_merge($mappings, self::sectionAPerson(
            self::SECTION_A.'.Parent2[0].PaddedEntry[0]',
            'applicant.family.parent2',
            true,
        ));

        for ($i = 0; $i < 3; $i++) {
            $mappings = array_merge($mappings, self::sectionBCPerson(
                self::SECTION_B.".Child[{$i}].PaddedEntry[0]",
                "applicant.family.children.{$i}",
                $i === 0,
            ));
        }

        for ($i = 0; $i < 3; $i++) {
            $mappings = array_merge($mappings, self::sectionBCPerson(
                self::SECTION_C.".Sibling[{$i}].PaddedEntry[0]",
                "applicant.family.siblings.{$i}",
                false,
            ));
        }

        return $mappings;
    }

    /** @return list<MappingRow> */
    private static function sectionAPerson(string $prefix, string $canonicalPrefix, bool $required): array
    {
        return [
            ["{$canonicalPrefix}.family_name", "{$prefix}.PersonalData[0].Row[0].FamilyName[0]", $required],
            ["{$canonicalPrefix}.given_names", "{$prefix}.PersonalData[0].Row[0].GivenNames[0]", $required],
            ["{$canonicalPrefix}.date_of_birth", "{$prefix}.PersonalData[0].Row[0].DOB[0]", $required],
            ["{$canonicalPrefix}.country_of_birth", "{$prefix}.PersonalData[1].Row[0].COB[0]", false],
            ["{$canonicalPrefix}.address.full", "{$prefix}.PersonalData[1].Row[0].Address[0]", false],
            ["{$canonicalPrefix}.marital_status", "{$prefix}.PersonalData[1].Row[0].MaritalStatus[0]", false],
        ];
    }

    /** @return list<MappingRow> */
    private static function sectionBCPerson(string $prefix, string $canonicalPrefix, bool $required): array
    {
        return [
            ["{$canonicalPrefix}.relationship", "{$prefix}.PersonalData[0].Row[0].Relationship[0]", false],
            ["{$canonicalPrefix}.family_name", "{$prefix}.PersonalData[0].Row[0].FamilyName[0]", $required],
            ["{$canonicalPrefix}.given_names", "{$prefix}.PersonalData[0].Row[0].GivenNames[0]", $required],
            ["{$canonicalPrefix}.date_of_birth", "{$prefix}.PersonalData[0].Row[0].DOB[0]", $required],
            ["{$canonicalPrefix}.country_of_birth", "{$prefix}.PersonalData[1].Row[0].COB[0]", false],
            ["{$canonicalPrefix}.address.full", "{$prefix}.PersonalData[1].Row[0].Address[0]", false],
            ["{$canonicalPrefix}.marital_status", "{$prefix}.PersonalData[1].Row[0].MaritalStatus[0]", false],
            ["{$canonicalPrefix}.contact.email", "{$prefix}.PersonalData[1].Row[0].Email[0]", false],
        ];
    }
}
