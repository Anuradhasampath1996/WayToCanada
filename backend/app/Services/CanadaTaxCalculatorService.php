<?php

namespace App\Services;

class CanadaTaxCalculatorService
{
    public function __construct(private CanadaTaxRatesService $ratesService) {}

    /**
     * @return array<string, mixed>
     */
    public function calculate(float $annualIncome, string $province): array
    {
        $province = strtoupper($province);
        $rates    = $this->ratesService->activeRates();

        if (! isset($rates['provinces'][$province])) {
            throw new \InvalidArgumentException("Unknown province code: {$province}");
        }

        $federalCfg   = $rates['federal'];
        $provincialCfg = $rates['provinces'][$province];

        $federalTax   = $this->taxFromBrackets($annualIncome, $federalCfg['brackets']);
        $provincialTax = $this->taxFromBrackets($annualIncome, $provincialCfg['brackets']);

        $federalBpaCredit   = min($federalTax, ($federalCfg['basic_personal_amount'] ?? 0) * ($federalCfg['brackets'][0]['rate'] ?? 0.15));
        $provincialBpaCredit = min($provincialTax, ($provincialCfg['basic_personal_amount'] ?? 0) * ($provincialCfg['brackets'][0]['rate'] ?? 0.05));

        $federalNet   = max(0, $federalTax - $federalBpaCredit);
        $provincialNet = max(0, $provincialTax - $provincialBpaCredit);

        $cpp = $this->estimateCpp($annualIncome, $rates['cpp'] ?? []);
        $ei  = $this->estimateEi($annualIncome, $rates['ei'] ?? []);

        $totalTax = $federalNet + $provincialNet;
        $netIncome = max(0, $annualIncome - $totalTax - $cpp - $ei);

        return [
            'annual_income'      => round($annualIncome, 2),
            'province'           => $province,
            'province_name'      => $provincialCfg['name'],
            'federal_tax'        => round($federalNet, 2),
            'provincial_tax'     => round($provincialNet, 2),
            'total_income_tax'   => round($totalTax, 2),
            'cpp_contribution'   => round($cpp, 2),
            'ei_premium'         => round($ei, 2),
            'total_deductions'   => round($totalTax + $cpp + $ei, 2),
            'net_annual_income'  => round($netIncome, 2),
            'effective_rate'     => $annualIncome > 0
                ? round(($totalTax / $annualIncome) * 100, 2)
                : 0,
            'disclaimer'         => 'Estimate only — not official CRA advice. Verify with a tax professional or PDOC.',
        ];
    }

    /** @param array<int, array{min: float, max: float|null, rate: float}> $brackets */
    private function taxFromBrackets(float $income, array $brackets): float
    {
        $tax = 0.0;

        foreach ($brackets as $bracket) {
            $min  = (float) $bracket['min'];
            $max  = $bracket['max'] !== null ? (float) $bracket['max'] : PHP_FLOAT_MAX;
            $rate = (float) $bracket['rate'];

            if ($income <= $min) {
                break;
            }

            $taxableInBracket = min($income, $max) - $min;
            if ($taxableInBracket > 0) {
                $tax += $taxableInBracket * $rate;
            }
        }

        return $tax;
    }

    /** @param array<string, float|int> $cpp */
    private function estimateCpp(float $income, array $cpp): float
    {
        $ympe    = (float) ($cpp['ympe'] ?? 71300);
        $exempt  = (float) ($cpp['basic_exemption'] ?? 3500);
        $rate    = (float) ($cpp['employee_rate'] ?? 0.0595);
        $max     = (float) ($cpp['max_contribution'] ?? 4034.10);

        $pensionable = max(0, min($income, $ympe) - $exempt);

        return min($max, round($pensionable * $rate, 2));
    }

    /** @param array<string, float|int> $ei */
    private function estimateEi(float $income, array $ei): float
    {
        $maxInsurable = (float) ($ei['max_insurable'] ?? 65700);
        $rate         = (float) ($ei['employee_rate'] ?? 0.0164);
        $maxPremium   = (float) ($ei['max_premium'] ?? 1077.48);

        return min($maxPremium, round(min($income, $maxInsurable) * $rate, 2));
    }
}
