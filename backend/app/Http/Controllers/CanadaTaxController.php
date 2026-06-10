<?php

namespace App\Http\Controllers;

use App\Services\CanadaTaxCalculatorService;
use App\Services\CanadaTaxRatesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CanadaTaxController extends Controller
{
    /** GET /api/v1/tax/rates */
    public function rates(CanadaTaxRatesService $rates): JsonResponse
    {
        return response()->json([
            'meta'  => $rates->meta(),
            'rates' => [
                'federal'   => $rates->activeRates()['federal'] ?? null,
                'provinces' => array_map(
                    fn ($p) => ['name' => $p['name'], 'brackets' => $p['brackets'], 'basic_personal_amount' => $p['basic_personal_amount'] ?? null],
                    $rates->activeRates()['provinces'] ?? []
                ),
                'cpp'       => $rates->activeRates()['cpp'] ?? null,
                'ei'        => $rates->activeRates()['ei'] ?? null,
            ],
        ]);
    }

    /** POST /api/v1/tax/calculate */
    public function calculate(Request $request, CanadaTaxCalculatorService $calculator): JsonResponse
    {
        $data = $request->validate([
            'annual_income' => 'required|numeric|min:0|max:10000000',
            'province'      => 'required|string|size:2',
        ]);

        try {
            return response()->json([
                'result' => $calculator->calculate((float) $data['annual_income'], $data['province']),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
