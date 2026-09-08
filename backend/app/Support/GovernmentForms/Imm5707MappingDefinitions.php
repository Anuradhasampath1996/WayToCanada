<?php

namespace App\Support\GovernmentForms;

/**
 * IMM 5707 (01-2023) — Family Information (visitors / students / workers).
 * C1: applicant + spouse + parents + first child names/DOB/COB.
 *
 * @phpstan-type MappingRow array{0: string, 1: string, 2: bool, 3?: string}
 */
final class Imm5707MappingDefinitions
{
    private const SECTION_A = 'IMM_5707[0].page1[0].SectionA[0]';

    private const SECTION_B = 'IMM_5707[0].page1[0].SectionB[0]';

    /**
     * @return list<MappingRow>
     */
    public static function all(): array
    {
        return array_merge(
            self::person(self::SECTION_A.'.Applicant[0].PaddedEntry[0]', 'applicant.personal', true),
            self::person(self::SECTION_A.'.Spouse[0].PaddedEntry[0]', 'applicant.family.spouse', false),
            self::person(self::SECTION_A.'.Parent1[0].PaddedEntry[0]', 'applicant.family.parent1', false),
            self::person(self::SECTION_A.'.Parent2[0].PaddedEntry[0]', 'applicant.family.parent2', false),
            self::person(self::SECTION_B.'.Child[0].PaddedEntry[0]', 'applicant.family.children.0', false),
        );
    }

    /**
     * @return list<MappingRow>
     */
    private static function person(string $entry, string $canonicalPrefix, bool $required): array
    {
        // PersonalData[0] = names; PersonalData[1] = DOB / COB / …
        return [
            ["{$canonicalPrefix}.family_name", "{$entry}.PersonalData[0].FamilyName[0]", $required, 'name'],
            ["{$canonicalPrefix}.given_names", "{$entry}.PersonalData[0].GivenNames[0]", $required, 'name'],
            ["{$canonicalPrefix}.date_of_birth", "{$entry}.PersonalData[1].DOB[0]", $required, 'date'],
            ["{$canonicalPrefix}.country_of_birth", "{$entry}.PersonalData[1].COB[0]", false, 'text'],
        ];
    }
}
