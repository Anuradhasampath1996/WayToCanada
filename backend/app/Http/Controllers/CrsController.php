<?php

namespace App\Http\Controllers;

use App\Models\ExpressEntryDraw;
use App\Services\CrsRulesService;
use App\Services\CrsRulesSyncService;
use App\Services\CrsScoringService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CrsController extends Controller
{
    public function __construct(
        private CrsRulesService $rulesService,
        private CrsScoringService $scoringService,
        private CrsRulesSyncService $syncService,
    ) {}

    /** GET /crs/rules — active scoring rules metadata (public). */
    public function rules(): JsonResponse
    {
        return response()->json([
            'meta'  => $this->rulesService->meta(),
            'rules' => $this->rulesService->activeRules(),
        ]);
    }

    /** POST /crs/calculate — authoritative CRS calculation (auth optional for consultants). */
    public function calculate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'has_spouse' => 'boolean',
            'main'       => 'required|array',
            'spouse'     => 'nullable|array',
            'noc'        => 'nullable|array',
            'noc.code'   => 'nullable|string|max:10',
            'noc.teer'   => 'nullable|integer|min:0|max:5',
            'noc.title'  => 'nullable|string|max:200',
        ]);

        $result = $this->scoringService->calculate($data);

        return response()->json($result);
    }

    /** GET /crs/draws — recent Express Entry draws. */
    public function draws(Request $request): JsonResponse
    {
        $limit = min(20, max(5, (int) $request->query('limit', 10)));

        $draws = ExpressEntryDraw::orderByDesc('draw_date')
            ->orderByDesc('draw_number')
            ->limit($limit)
            ->get();

        return response()->json([
            'data'    => $draws,
            'source'  => 'IRCC open data (auto-synced daily)',
            'updated' => ExpressEntryDraw::max('updated_at'),
        ]);
    }

    /** POST /crs/sync — trigger rules + draw sync (consultant auth). */
    public function sync(Request $request): JsonResponse
    {
        $result = $this->syncService->sync();

        return response()->json([
            'message' => 'CRS sync completed.',
            'result'  => $result,
            'meta'    => $this->rulesService->meta(),
        ]);
    }
}
