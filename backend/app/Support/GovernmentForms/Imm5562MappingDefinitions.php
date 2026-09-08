<?php

namespace App\Support\GovernmentForms;

/**
 * IMM 5562 (07-2024) — Supplementary Information: Your Travels.
 * C1: applicant name. C2: up to 3 travel rows from main_data.travelHistory.
 *
 * @phpstan-type MappingRow array{0: string, 1: string, 2: bool, 3?: string}
 */
final class Imm5562MappingDefinitions
{
    private const ROOT = 'IMM_5562[0].Page1[0]';

    private const LIST_A = self::ROOT.'.Item2A[0].PaddedList2A[0].List2A[0]';

    /**
     * @return list<MappingRow>
     */
    public static function all(): array
    {
        $rows = [
            ['applicant.personal.family_name', self::ROOT.'.Name[0].Item1[0].FamilyName[0]', true, 'name'],
            ['applicant.personal.given_names', self::ROOT.'.Name[0].Item1[0].GivenNames[0]', true, 'name'],
        ];

        for ($i = 0; $i < 3; $i++) {
            $s = self::LIST_A.".s1[{$i}]";
            $prefix = "applicant.travel.{$i}";
            $rows[] = ["{$prefix}.from_date", "{$s}.fromDate[0]", false, 'date'];
            $rows[] = ["{$prefix}.to_date", "{$s}.toDate[0]", false, 'date'];
            $rows[] = ["{$prefix}.destination", "{$s}.Destination[0]", false, 'text'];
            $rows[] = ["{$prefix}.purpose", "{$s}.PurposeofTravel[0]", false, 'text'];
            $rows[] = ["{$prefix}.details", "{$s}.Details[0]", false, 'text'];
        }

        return $rows;
    }
}
