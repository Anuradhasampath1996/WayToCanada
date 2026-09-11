<?php

namespace App\Support\GovernmentForms;

/**
 * IMM 5669 (Schedule A — Background/Declaration) mappings.
 *
 * Official template historically had no datasets packet; the Java engine injects an
 * empty datasets slot before fill (see IMM5669_FILL_STRATEGY.md).
 *
 * C1: name / DOB / parents
 * C2: nameOfApplicant + country of birth (page3.country1)
 *
 * @phpstan-type MappingRow array{0: string, 1: string, 2: bool, 3?: string}
 */
final class Imm5669MappingDefinitions
{
    private const ROOT = 'IMM_5669[0]';

    /**
     * @return list<MappingRow>
     */
    public static function all(): array
    {
        return [
            ['applicant.personal.family_name', self::ROOT.'.familyName[0]', true, 'name'],
            ['applicant.personal.given_names', self::ROOT.'.givenName[0]', true, 'name'],
            ['applicant.personal.full_name', self::ROOT.'.nameOfApplicant[0]', false, 'name'],
            ['applicant.personal.date_of_birth', self::ROOT.'.birthDate3[0]', true, 'date'],
            ['applicant.personal.country_of_birth', self::ROOT.'.page3[0].country1[0]', false, 'text'],
            ['applicant.family.parent1.family_name', self::ROOT.'.fathersFamilyName[0]', false, 'name'],
            ['applicant.family.parent1.given_names', self::ROOT.'.fathersGivenName[0]', false, 'name'],
            ['applicant.family.parent2.family_name', self::ROOT.'.mothersBirthFamilyName[0]', false, 'name'],
            ['applicant.family.parent2.given_names', self::ROOT.'.mothersGivenName[0]', false, 'name'],
        ];
    }
}
