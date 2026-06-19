<?php

namespace App\Services;

use App\Models\QuestionnaireSubmission;

class QuestionnaireCrsBridgeService
{
    public function __construct(private CrsScoringService $scoring) {}

    /** @return array<string, mixed>|null */
    public function estimateFromSubmission(?QuestionnaireSubmission $submission): ?array
    {
        if (! $submission) {
            return null;
        }

        $input = $this->mapToCrsInput($submission);
        if ($input === null) {
            return null;
        }

        $result = $this->scoring->calculate($input);
        $total  = $result['crs']['total'] ?? null;

        return [
            'rules_version'   => $result['rules_version'] ?? null,
            'crs_total'       => $total,
            'crs_breakdown'   => $result['crs'] ?? [],
            'fsw_eligible'    => $result['fsw']['eligible'] ?? null,
            'fsw_score'       => $result['fsw']['total'] ?? null,
            'pathway_hints'   => $result['pathways'] ?? [],
            'prefill_fields'  => $input['_filled'] ?? [],
            'data_complete'   => count($input['_filled'] ?? []) >= 4,
        ];
    }

    /** @return array<string, mixed>|null */
    private function mapToCrsInput(QuestionnaireSubmission $submission): ?array
    {
        $step1  = $submission->step1_data ?? [];
        $main   = $submission->main_data ?? [];
        $spouse = $submission->spouse_data ?? [];
        $step3  = $submission->accompanying_data['step3'] ?? $submission->step1_data ?? [];
        if (! is_array($step3)) {
            $step3 = [];
        }

        $filled = [];
        $hasSpouse = strtolower((string) ($step1['married'] ?? '')) === 'yes';

        $mainInput = [];
        $age = $this->ageFromDob($main['dob'] ?? $main['passportDob'] ?? null);
        if ($age !== null) {
            $mainInput['age'] = $age;
            $filled[] = 'age';
        }

        $edu = $this->mapEducation($main['educationLevels'] ?? $step3['eduLevels'] ?? null);
        if ($edu) {
            $mainInput['education'] = $edu;
            $filled[] = 'education';
        }

        $mainInput['canadian_education'] = $this->mapCanadianStudy(
            $main['studiedInCanada'] ?? null,
            $main['canadaStudyStart'] ?? null,
            $main['canadaStudyEnd'] ?? null,
        );

        if ($mainInput['canadian_education'] !== 'none') {
            $filled[] = 'canadian_education';
        }

        if (strtolower((string) ($main['languageTest'] ?? '')) === 'yes' || ! empty($main['scores'])) {
            $mainInput['english_test_type'] = strtolower((string) ($main['languageTestType'] ?? 'ielts')) === 'celpip' ? 'celpip' : 'ielts';
            $mainInput['english_scores']    = $this->mapScores($main['scores'] ?? []);
            $filled[] = 'english';
        } elseif (strtolower((string) ($step3['intlTestTaken'] ?? '')) === 'yes') {
            $mainInput['english_test_type'] = strtolower((string) ($step3['intlTestType'] ?? 'ielts')) === 'celpip' ? 'celpip' : 'ielts';
            $mainInput['english_scores']    = $this->mapScores($step3['intlTestScores'] ?? []);
            $filled[] = 'english';
        }

        $foreign = $this->mapForeignWork($main['workExperience'] ?? null);
        if ($foreign === 0) {
            $foreign = $this->mapStep3Exp($step3['totalExpYears'] ?? null);
        }
        if ($foreign > 0) {
            $mainInput['foreign_work_years'] = $foreign;
            $filled[] = 'foreign_work';
        }

        $canWork = $this->mapCanadianWork(
            $main['canadianWork'] ?? null,
            $main['canadianWorkStart'] ?? null,
            $main['canadianWorkEnd'] ?? null,
        );
        if ($canWork > 0) {
            $mainInput['canadian_work_years'] = $canWork;
            $filled[] = 'canadian_work';
        }

        if (strtolower((string) ($main['canadianRelatives'] ?? '')) === 'yes') {
            $mainInput['sibling_in_canada'] = true;
            $filled[] = 'sibling';
        }

        if (strtolower((string) ($main['provincialNomination'] ?? '')) === 'yes') {
            $mainInput['provincial_nomination'] = true;
            $filled[] = 'pnp';
        }

        if (strtolower((string) ($main['tradeCertificate'] ?? '')) === 'yes') {
            $mainInput['trade_certificate'] = true;
            $filled[] = 'trade_certificate';
        }

        if (count($filled) < 2) {
            return null;
        }

        $spouseInput = [];
        if ($hasSpouse && is_array($spouse) && $spouse !== []) {
            $spEdu = $this->mapEducation($spouse['educationLevels'] ?? $step3['spouseEduLevel'] ?? null);
            if ($spEdu) {
                $spouseInput['education'] = $spEdu;
            }
            if (! empty($spouse['scores'])) {
                $spouseInput['english_test_type'] = strtolower((string) ($spouse['languageTestType'] ?? 'ielts')) === 'celpip' ? 'celpip' : 'ielts';
                $spouseInput['english_scores']  = $this->mapScores($spouse['scores']);
            }
            $spCan = $this->mapCanadianWork(
                $spouse['canadianWork'] ?? null,
                $spouse['canadianWorkStart'] ?? null,
                $spouse['canadianWorkEnd'] ?? null,
            );
            if ($spCan > 0) {
                $spouseInput['canadian_work_years'] = $spCan;
            }
        }

        $noc = array_filter([
            'code'  => $main['intendedNocCode'] ?? null,
            'teer'  => isset($main['intendedNocTeer']) ? (int) $main['intendedNocTeer'] : null,
            'title' => $main['intendedNocTitle'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');

        return [
            'has_spouse' => $hasSpouse,
            'main'       => $mainInput,
            'spouse'     => $spouseInput !== [] ? $spouseInput : null,
            'noc'        => $noc !== [] ? $noc : null,
            '_filled'    => $filled,
        ];
    }

    private function ageFromDob(mixed $dob): ?int
    {
        if (! $dob) {
            return null;
        }
        try {
            $d = new \DateTimeImmutable((string) $dob);
            $now = new \DateTimeImmutable('today');
            $age = (int) $d->diff($now)->y;

            return ($age >= 16 && $age <= 60) ? $age : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /** @param  mixed  $levels */
    private function mapEducation($levels): ?string
    {
        $arr = is_array($levels) ? array_map('strval', $levels) : (is_string($levels) && $levels !== '' ? [$levels] : []);
        if ($arr === []) {
            return null;
        }
        if (in_array('phd', $arr, true)) {
            return 'doctoral';
        }
        if (in_array('masters', $arr, true)) {
            return 'masters';
        }
        if (in_array('bachelors', $arr, true)) {
            return 'bachelors';
        }
        if (in_array('diploma', $arr, true)) {
            return 'two_year';
        }
        if (in_array('al', $arr, true)) {
            return 'secondary';
        }
        if (count($arr) >= 2) {
            return 'two_or_more';
        }

        return 'bachelors';
    }

    private function mapForeignWork(mixed $value): float
    {
        return match (strtolower((string) $value)) {
            '3_or_more' => 3.0,
            '1_to_2'    => 2.0,
            default     => 0.0,
        };
    }

    private function mapStep3Exp(mixed $value): float
    {
        return match (strtolower((string) $value)) {
            '10_plus', '6_9', '3_5' => 3.0,
            '1_2' => 2.0,
            default => 0.0,
        };
    }

    private function mapCanadianStudy(mixed $studied, mixed $start, mixed $end): string
    {
        if (strtolower((string) $studied) !== 'yes') {
            return 'none';
        }
        try {
            $s = $start ? new \DateTimeImmutable((string) $start) : null;
            $e = $end ? new \DateTimeImmutable((string) $end) : null;
            if ($s && $e) {
                $years = $s->diff($e)->y + ($s->diff($e)->m / 12);

                return $years >= 3 ? 'three_plus' : 'one_two_year';
            }
        } catch (\Throwable) {
            // fall through
        }

        return 'one_two_year';
    }

    private function mapCanadianWork(mixed $yesNo, mixed $start, mixed $end): float
    {
        if (strtolower((string) $yesNo) !== 'yes') {
            return 0.0;
        }
        try {
            $s = $start ? new \DateTimeImmutable((string) $start) : null;
            $e = $end ? new \DateTimeImmutable((string) $end) : new \DateTimeImmutable('today');
            if ($s) {
                $years = max(1, min(5, (int) round($s->diff($e)->days / 365.25)));

                return (float) $years;
            }
        } catch (\Throwable) {
            // fall through
        }

        return 1.0;
    }

    /** @param  mixed  $scores
     * @return array{speaking:float,listening:float,reading:float,writing:float}
     */
    private function mapScores($scores): array
    {
        $s = is_array($scores) ? $scores : [];

        return [
            'speaking'  => (float) str_replace(',', '.', (string) ($s['speaking'] ?? 0)),
            'listening' => (float) str_replace(',', '.', (string) ($s['listening'] ?? 0)),
            'reading'   => (float) str_replace(',', '.', (string) ($s['reading'] ?? 0)),
            'writing'   => (float) str_replace(',', '.', (string) ($s['writing'] ?? 0)),
        ];
    }
}
