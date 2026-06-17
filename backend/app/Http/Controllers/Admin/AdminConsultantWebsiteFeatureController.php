<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ConsultantWebsiteFeatureSection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminConsultantWebsiteFeatureController extends Controller
{
    public function index(): JsonResponse
    {
        $sections = ConsultantWebsiteFeatureSection::orderBy('sort_order')->orderBy('id')->get();

        return response()->json(['data' => $sections]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $section = ConsultantWebsiteFeatureSection::create($data);

        return response()->json(['data' => $section, 'message' => 'Feature section created.'], 201);
    }

    public function update(Request $request, ConsultantWebsiteFeatureSection $featureSection): JsonResponse
    {
        $featureSection->update($this->validated($request));

        return response()->json(['data' => $featureSection, 'message' => 'Feature section updated.']);
    }

    public function toggle(ConsultantWebsiteFeatureSection $featureSection): JsonResponse
    {
        $featureSection->update(['is_active' => ! $featureSection->is_active]);

        return response()->json(['data' => $featureSection]);
    }

    public function destroy(ConsultantWebsiteFeatureSection $featureSection): JsonResponse
    {
        $featureSection->delete();

        return response()->json(['message' => 'Feature section deleted.']);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'slug'           => 'required|string|max:100',
            'tag'            => 'nullable|string|max:80',
            'title'          => 'required|string|max:255',
            'subtitle'       => 'nullable|string|max:255',
            'description'    => 'required|string',
            'bullet_points'  => 'nullable|array',
            'bullet_points.*'=> 'string|max:255',
            'icon'           => 'nullable|string|max:60',
            'media_type'     => 'required|in:mock,image,gif,video',
            'media_url'      => 'nullable|string|max:500',
            'mock_variant'   => 'nullable|string|max:60',
            'media_alt'      => 'nullable|string|max:255',
            'layout'         => 'required|in:left,right',
            'sort_order'     => 'integer',
            'is_active'      => 'boolean',
        ]);
    }
}
