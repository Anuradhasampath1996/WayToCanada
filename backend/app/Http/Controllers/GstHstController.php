<?php

namespace App\Http\Controllers;

use App\Services\GstHstCalculatorService;
use App\Services\GstHstRatesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GstHstController extends Controller
{
    /** GET /api/v1/tax/gst-hst/rates — for payment checkout */
    public function rates(GstHstRatesService $rates): JsonResponse
    {
        return response()->json([
            'meta'      => $rates->meta(),
            'rates'     => $rates->formattedTable(),
            'provinces' => $rates->provinceOptions(),
        ]);
    }

    /** POST /api/v1/tax/gst-hst/calculate — apply tax on payment subtotal */
    public function calculate(Request $request, GstHstCalculatorService $calculator): JsonResponse
    {
        $data = $request->validate([
            'subtotal' => 'required|numeric|min:0|max:10000000',
            'province' => 'required|string|size:2',
        ]);

        try {
            return response()->json([
                'result' => $calculator->calculate((float) $data['subtotal'], $data['province']),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
