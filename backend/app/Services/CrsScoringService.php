<?php

namespace App\Services;

class CrsScoringService
{
    public function __construct(private CrsRulesService $rulesService) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function calculate(array $input): array
    {
        $rules     = $this->rulesService->activeRules();
        $hasSpouse = (bool) ($input['has_spouse'] ?? false);
        $main      = $this->normalizePerson($input['main'] ?? []);
        $spouse    = $hasSpouse ? $this->normalizeSpouse($input['spouse'] ?? []) : null;

        $crs = $this->calcCrs($rules, $main, $hasSpouse, $spouse);
        $fsw = $this->calcFsw($rules, $main);

        return [
            'rules_version' => $rules['version'] ?? config('crs_rules.version'),
            'crs'           => $crs,
            'fsw'           => $fsw,
            'pathways'      => $this->pathwayRecs($crs, $fsw, $main, $input['noc'] ?? []),
        ];
    }

    /** @param  array<string, mixed>  $raw */
    private function normalizePerson(array $raw): array
    {
        $testType = $raw['english_test_type'] ?? 'ielts';

        return [
            'age'                      => max(16, min(60, (int) ($raw['age'] ?? 28))),
            'education'                => $raw['education'] ?? 'bachelors',
            'canadian_education'       => $raw['canadian_education'] ?? 'none',
            'english_test_type'        => $testType,
            'english_scores'           => $raw['english_scores'] ?? ['speaking' => 0, 'listening' => 0, 'reading' => 0, 'writing' => 0],
            'french_clb'               => $this->resolveFrenchClb($raw),
            'canadian_work_years'      => (float) ($raw['canadian_work_years'] ?? 0),
            'foreign_work_years'       => (float) ($raw['foreign_work_years'] ?? 0),
            'job_offer'                => $raw['job_offer'] ?? 'none',
            'provincial_nomination'    => (bool) ($raw['provincial_nomination'] ?? false),
            'sibling_in_canada'        => (bool) ($raw['sibling_in_canada'] ?? false),
            'trade_certificate'        => (bool) ($raw['trade_certificate'] ?? false),
        ];
    }

    /** @param  array<string, mixed>  $raw */
    private function normalizeSpouse(array $raw): array
    {
        return [
            'education'           => $raw['education'] ?? 'bachelors',
            'english_test_type'   => $raw['english_test_type'] ?? 'ielts',
            'english_scores'      => $raw['english_scores'] ?? ['speaking' => 0, 'listening' => 0, 'reading' => 0, 'writing' => 0],
            'canadian_work_years' => (float) ($raw['canadian_work_years'] ?? 0),
        ];
    }

    /** @param  array<string, mixed>  $raw
     * @return array{speaking:int,listening:int,reading:int,writing:int}
     */
    private function resolveFrenchClb(array $raw): array
    {
        if (! empty($raw['french_clb']) && is_array($raw['french_clb'])) {
            return $this->clampClb($raw['french_clb']);
        }

        $type   = $raw['french_test_type'] ?? '';
        $scores = $raw['french_scores'] ?? [];
        if ($type === 'tef' && is_array($scores)) {
            $rules = $this->rulesService->activeRules();

            return [
                'speaking'  => $this->tefToClb($rules, 'speaking', (float) ($scores['speaking'] ?? 0)),
                'listening' => $this->tefToClb($rules, 'listening', (float) ($scores['listening'] ?? 0)),
                'reading'   => $this->tefToClb($rules, 'reading', (float) ($scores['reading'] ?? 0)),
                'writing'   => $this->tefToClb($rules, 'writing', (float) ($scores['writing'] ?? 0)),
            ];
        }

        if ($type === 'tcf' && is_array($scores)) {
            return $this->clampClb([
                'speaking'  => (int) ($scores['speaking'] ?? 0),
                'listening' => (int) ($scores['listening'] ?? 0),
                'reading'   => (int) ($scores['reading'] ?? 0),
                'writing'   => (int) ($scores['writing'] ?? 0),
            ]);
        }

        return ['speaking' => 0, 'listening' => 0, 'reading' => 0, 'writing' => 0];
    }

    /** @param  array<string, mixed>  $rules */
    private function calcCrs(array $rules, array $p, bool $hasSpouse, ?array $spouse): array
    {
        $firstClb = $this->englishToClb($rules, $p['english_test_type'], $p['english_scores']);
        $frClb    = $p['french_clb'];

        $agePts  = $this->agePts($rules, $p['age'], $hasSpouse);
        $eduPts  = $this->eduPts($rules, $p['education'], $hasSpouse);
        $lang1   = $this->langSkillTotal($rules, $firstClb, $hasSpouse, 'first');
        $lang2   = $this->langSkillTotal($rules, $frClb, $hasSpouse, 'second');
        $canWe   = $this->canWePts($rules, $p['canadian_work_years'], $hasSpouse);

        $spousePts = 0;
        if ($hasSpouse && $spouse) {
            $spClb = $this->englishToClb($rules, $spouse['english_test_type'], $spouse['english_scores']);
            $spousePts =
                ($rules['spouse_education'][$spouse['education']] ?? 0) +
                $this->spouseLangTotal($rules, $spClb) +
                ($rules['spouse_canadian_work'][min((int) floor($spouse['canadian_work_years']), 5)] ?? 0);
        }

        $humanCapital  = $agePts + $eduPts + $lang1 + $lang2 + $canWe + $spousePts;
        $skillTransfer = $this->skillTransfer($rules, $p, $firstClb);
        $additional    = $this->additionalPts($rules, $p, $frClb, $firstClb);

        return [
            'human_capital'   => $humanCapital,
            'skill_transfer'  => $skillTransfer,
            'additional'      => $additional,
            'total'           => $humanCapital + $skillTransfer + $additional,
            'age_pts'         => $agePts,
            'edu_pts'         => $eduPts,
            'first_lang_total'=> $lang1,
            'second_lang_total'=> $lang2,
            'can_we_pts'      => $canWe,
            'spouse_pts'      => $spousePts,
            'first_clb'       => $firstClb,
        ];
    }

    /** @param  array<string, mixed>  $rules */
    private function calcFsw(array $rules, array $p): array
    {
        $fsw   = $rules['fsw'];
        $clb   = $this->englishToClb($rules, $p['english_test_type'], $p['english_scores']);
        $avg   = ($clb['speaking'] + $clb['listening'] + $clb['reading'] + $clb['writing']) / 4;

        $language = 0;
        foreach ($fsw['language'] as $band) {
            if ($avg >= $band['min_avg_clb']) {
                $language = $band['pts'];
                break;
            }
        }
        $frMin = min($p['french_clb']);
        if ($frMin >= 5) {
            $language = min(28, $language + 4);
        }

        $education  = $fsw['education'][$p['education']] ?? 0;
        $expIdx     = min((int) floor($p['foreign_work_years'] + $p['canadian_work_years']), 5);
        $experience = $fsw['experience'][$expIdx] ?? 0;

        $age = 0;
        if ($p['age'] >= 18 && $p['age'] <= 35) {
            $age = $fsw['age']['18_35'];
        } elseif (isset($fsw['age'][(string) $p['age']])) {
            $age = $fsw['age'][(string) $p['age']];
        }

        $policies = $rules['policies'] ?? [];
        $arranged = ($policies['job_offer_fsw_arranged'] ?? true) && $p['job_offer'] !== 'none'
            ? ($fsw['arranged_employment'] ?? 10) : 0;

        $adaptability = min(
            $fsw['adaptability_max'] ?? 10,
            ($p['canadian_work_years'] >= 1 ? 5 : 0) + ($p['sibling_in_canada'] ? 5 : 0)
        );

        $total = $language + $education + $experience + $age + $arranged + $adaptability;

        return [
            'language' => $language, 'education' => $education, 'experience' => $experience,
            'age' => $age, 'arranged' => $arranged, 'adaptability' => $adaptability,
            'total' => $total, 'eligible' => $total >= ($fsw['pass_mark'] ?? 67),
        ];
    }

    /** @param  array<string, mixed>  $crs
     * @param  array<string, mixed>  $fsw
     * @param  array<string, mixed>  $p
     * @param  array<string, mixed>  $noc
     * @return list<array<string, mixed>>
     */
    private function pathwayRecs(array $crs, array $fsw, array $p, array $noc): array
    {
        $clb    = $crs['first_clb'];
        $minClb = min($clb['speaking'], $clb['listening'], $clb['reading'], $clb['writing']);
        $teer   = isset($noc['teer']) ? (int) $noc['teer'] : null;

        return [
            [
                'pathway' => 'Express Entry – Federal Skilled Worker',
                'backend_value' => 'Express Entry – Federal Skilled Worker',
                'eligible' => $fsw['eligible'] && $minClb >= 7 && $p['foreign_work_years'] >= 1,
                'notes' => $fsw['eligible'] ? "FSW {$fsw['total']}/100 ✓ | CRS {$crs['total']}" : "FSW {$fsw['total']}/100 — needs 67+",
            ],
            [
                'pathway' => 'Express Entry – Canadian Experience Class',
                'backend_value' => 'Express Entry – Canadian Experience Class',
                'eligible' => $p['canadian_work_years'] >= 1 && $minClb >= 7,
                'notes' => $p['canadian_work_years'] >= 1 ? "{$p['canadian_work_years']} yr Canadian WE | CLB {$minClb}" : 'Needs ≥1 yr Canadian skilled work',
            ],
            [
                'pathway' => 'Express Entry – Federal Skilled Trades',
                'backend_value' => 'Express Entry – Federal Skilled Trades',
                'eligible' => $p['trade_certificate'] && $minClb >= 5,
                'notes' => $p['trade_certificate'] ? 'Trade certificate on file' : 'Needs certificate of qualification',
            ],
            [
                'pathway' => 'Provincial Nominee Program (General)',
                'backend_value' => 'Provincial Nominee Program',
                'eligible' => $crs['total'] >= 300 || $p['provincial_nomination'],
                'notes' => $p['provincial_nomination'] ? 'Provincial nomination (+600 CRS when issued)' : "CRS {$crs['total']} — explore PNP streams",
            ],
        ];
    }

    /** @param  array<string, mixed>  $rules
     * @param  array<string, float|int>  $scores
     * @return array{speaking:int,listening:int,reading:int,writing:int}
     */
    private function englishToClb(array $rules, string $type, array $scores): array
    {
        if ($type === 'celpip') {
            return $this->clampClb([
                'speaking'  => (int) round((float) ($scores['speaking'] ?? 0)),
                'listening' => (int) round((float) ($scores['listening'] ?? 0)),
                'reading'   => (int) round((float) ($scores['reading'] ?? 0)),
                'writing'   => (int) round((float) ($scores['writing'] ?? 0)),
            ]);
        }

        return [
            'speaking'  => $this->ieltsToClb($rules['ielts_speaking_clb'] ?? [], (float) ($scores['speaking'] ?? 0)),
            'listening' => $this->ieltsToClb($rules['ielts_listening_clb'] ?? [], (float) ($scores['listening'] ?? 0)),
            'reading'   => $this->ieltsToClb($rules['ielts_reading_clb'] ?? [], (float) ($scores['reading'] ?? 0)),
            'writing'   => $this->ieltsToClb($rules['ielts_writing_clb'] ?? [], (float) ($scores['writing'] ?? 0)),
        ];
    }

    /** @param  list<array{min:float,clb:int}>  $table */
    private function ieltsToClb(array $table, float $score): int
    {
        foreach ($table as $row) {
            if ($score >= ($row['min'] ?? 0)) {
                return (int) $row['clb'];
            }
        }

        return 0;
    }

    /** @param  array<string, mixed>  $rules */
    private function tefToClb(array $rules, string $skill, float $score): int
    {
        $table = $rules['tef_clb'][$skill] ?? [];
        foreach ($table as [$min, $clb]) {
            if ($score >= $min) {
                return (int) $clb;
            }
        }

        return 0;
    }

    /** @param  array{speaking?:int,listening?:int,reading?:int,writing?:int}  $clb */
    private function clampClb(array $clb): array
    {
        return [
            'speaking'  => max(0, min(12, (int) ($clb['speaking'] ?? 0))),
            'listening' => max(0, min(12, (int) ($clb['listening'] ?? 0))),
            'reading'   => max(0, min(12, (int) ($clb['reading'] ?? 0))),
            'writing'   => max(0, min(12, (int) ($clb['writing'] ?? 0))),
        ];
    }

    /** @param  array<string, mixed>  $rules */
    private function agePts(array $rules, int $age, bool $hasSpouse): int
    {
        $table = $rules['age_points'][$hasSpouse ? 'with_spouse' : 'without_spouse'] ?? [];
        if ($age <= 17) {
            return 0;
        }
        if (isset($table[$age])) {
            return (int) $table[$age];
        }
        if ($age >= 20 && $age <= 29) {
            return (int) ($table['20_29'] ?? 0);
        }
        if ($age >= 45) {
            return (int) ($table['45_plus'] ?? 0);
        }

        return 0;
    }

    /** @param  array<string, mixed>  $rules */
    private function eduPts(array $rules, string $level, bool $hasSpouse): int
    {
        $table = $rules['education_points'][$hasSpouse ? 'with_spouse' : 'without_spouse'] ?? [];

        return (int) ($table[$level] ?? 0);
    }

    /** @param  array{speaking:int,listening:int,reading:int,writing:int}  $clb
     * @param  array<string, mixed>  $rules
     */
    private function langSkillTotal(array $rules, array $clb, bool $hasSpouse, string $which): int
    {
        $table = $rules[$which === 'first' ? 'first_language_skill' : 'second_language_skill'][$hasSpouse ? 'with_spouse' : 'without_spouse'] ?? [];
        $total = 0;
        foreach (['speaking', 'listening', 'reading', 'writing'] as $skill) {
            $total += $table[min($clb[$skill], count($table) - 1)] ?? 0;
        }

        return $total;
    }

    /** @param  array{speaking:int,listening:int,reading:int,writing:int}  $clb
     * @param  array<string, mixed>  $rules
     */
    private function spouseLangTotal(array $rules, array $clb): int
    {
        $table = $rules['spouse_language'] ?? [];
        $total = 0;
        foreach (['speaking', 'listening', 'reading', 'writing'] as $skill) {
            $total += $table[min($clb[$skill], count($table) - 1)] ?? 0;
        }

        return $total;
    }

    /** @param  array<string, mixed>  $rules */
    private function canWePts(array $rules, float $years, bool $hasSpouse): int
    {
        $table = $rules['canadian_work'][$hasSpouse ? 'with_spouse' : 'without_spouse'] ?? [];
        $idx   = min((int) floor($years), count($table) - 1);

        return (int) ($table[$idx] ?? 0);
    }

    /** @param  array{speaking:int,listening:int,reading:int,writing:int}  $firstClb
     * @param  array<string, mixed>  $rules
     * @param  array<string, mixed>  $p
     */
    private function skillTransfer(array $rules, array $p, array $firstClb): int
    {
        $hasDegree = ! in_array($p['education'], ['none', 'secondary'], true);
        $minClb    = min($firstClb);
        $clb7      = $minClb >= 7;
        $clb9      = $minClb >= 9;
        $canWe     = $p['canadian_work_years'];
        $foreignWe = $p['foreign_work_years'];
        $pts       = 0;

        if ($hasDegree) {
            $pts += $clb9 ? 50 : ($clb7 ? 25 : 0);
        }
        if ($hasDegree && $canWe >= 1) {
            $pts += $canWe >= 2 ? 50 : 25;
        }
        if ($foreignWe >= 1) {
            $fwe3 = $foreignWe >= 3;
            if ($clb9) {
                $pts += $fwe3 ? 50 : 25;
            } elseif ($clb7) {
                $pts += $fwe3 ? 25 : 13;
            }
        }
        if ($foreignWe >= 1 && $canWe >= 1) {
            $fwe3 = $foreignWe >= 3;
            $cwe2 = $canWe >= 2;
            if ($fwe3 && $cwe2) {
                $pts += 50;
            } elseif ($fwe3 || $cwe2) {
                $pts += 25;
            } else {
                $pts += 13;
            }
        }
        if ($p['trade_certificate']) {
            if ($clb7) {
                $pts += 50;
            } elseif ($minClb >= 5) {
                $pts += 25;
            }
        }

        return min($pts, 100);
    }

    /** @param  array{speaking:int,listening:int,reading:int,writing:int}  $frClb
     * @param  array{speaking:int,listening:int,reading:int,writing:int}  $firstClb
     * @param  array<string, mixed>  $rules
     * @param  array<string, mixed>  $p
     */
    private function additionalPts(array $rules, array $p, array $frClb, array $firstClb): int
    {
        $pts      = 0;
        $policies = $rules['policies'] ?? [];

        if ($p['sibling_in_canada']) {
            $pts += (int) ($policies['sibling_pts'] ?? 15);
        }

        $frMin = min($frClb);
        $enMin = min($firstClb);
        foreach ($rules['french_bonus'] ?? [] as $band) {
            if ($frMin >= ($band['min_clb'] ?? 99)) {
                $maxEn = $band['english_max_clb'] ?? null;
                if ($maxEn === null || $enMin <= $maxEn) {
                    $pts += (int) $band['pts'];
                    break;
                }
            }
        }

        $studyBonus = $rules['canadian_study_bonus'][$p['canadian_education']] ?? 0;
        $pts += (int) $studyBonus;

        if ($p['provincial_nomination']) {
            $pts += (int) ($policies['provincial_nomination_pts'] ?? 600);
        }

        return $pts;
    }
}
