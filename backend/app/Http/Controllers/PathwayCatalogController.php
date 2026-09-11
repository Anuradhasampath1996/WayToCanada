<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Services\PathwayCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PathwayCatalogController extends Controller
{
    public function __construct(private PathwayCatalogService $catalog) {}

    /** GET /api/v1/consultant/pathways */
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'tree' => $this->catalog->tree(),
            'popular' => $this->catalog->popular(),
        ]);
    }

    /** GET /api/v1/consultant/clients/{profile}/pathways/suggested */
    public function suggested(Request $request, ClientProfile $profile): JsonResponse
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->first();

        return response()->json([
            'suggested' => $this->catalog->suggestForQuestionnaire($submission),
            'popular' => $this->catalog->popular(),
        ]);
    }
}
