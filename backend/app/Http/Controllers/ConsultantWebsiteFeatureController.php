<?php

namespace App\Http\Controllers;

use App\Models\ConsultantWebsiteFeatureSection;
use Illuminate\Http\JsonResponse;

class ConsultantWebsiteFeatureController extends Controller
{
    /** GET /api/v1/consultant-website/features */
    public function index(): JsonResponse
    {
        $sections = ConsultantWebsiteFeatureSection::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $sections]);
    }
}
