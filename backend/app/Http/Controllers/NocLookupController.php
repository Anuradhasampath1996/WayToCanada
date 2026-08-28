<?php

namespace App\Http\Controllers;

use App\Services\NocLookupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NocLookupController extends Controller
{
    /**
     * Suggest NOC 2021 codes from a plain-language job description.
     *
     * POST /api/v1/noc/suggest
     * body: { query: string }
     */
    public function suggest(Request $request, NocLookupService $lookup): JsonResponse
    {
        $data = $request->validate([
            'query' => ['required', 'string', 'min:3', 'max:200'],
        ]);

        if (! $lookup->available()) {
            return response()->json([
                'message' => 'NOC AI lookup is unavailable. Ask your consultant for help, or use the Canada.ca NOC finder.',
                'suggestions' => [],
            ], 503);
        }

        $result = $lookup->suggest($data['query']);
        if ($result === null) {
            return response()->json([
                'message' => 'Could not find a matching NOC. Try a clearer job title (e.g. “software developer”, “cook”, “accountant”).',
                'suggestions' => [],
            ], 422);
        }

        return response()->json($result);
    }
}
