<?php

namespace App\Http\Controllers;

use App\Models\ConsultantAgreementTemplate;
use App\Support\RetainerAgreementConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgreementTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $templates = ConsultantAgreementTemplate::where('consultant_id', $request->user()->id)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get();

        return response()->json(['templates' => $templates]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'       => 'required|string|max:120',
            'pathway'    => 'nullable|string|max:150',
            'config'     => 'required|array',
            'is_default' => 'boolean',
        ]);

        $config = $this->sanitizeTemplateConfig($data['config']);

        if ($data['is_default'] ?? false) {
            ConsultantAgreementTemplate::where('consultant_id', $request->user()->id)
                ->update(['is_default' => false]);
        }

        $template = ConsultantAgreementTemplate::create([
            'consultant_id' => $request->user()->id,
            'name'          => $data['name'],
            'pathway'       => $data['pathway'] ?? null,
            'config'        => $config,
            'is_default'    => $data['is_default'] ?? false,
        ]);

        return response()->json(['template' => $template, 'message' => 'Template saved.'], 201);
    }

    public function update(Request $request, ConsultantAgreementTemplate $template): JsonResponse
    {
        $this->authorizeTemplate($request, $template);

        $data = $request->validate([
            'name'       => 'sometimes|string|max:120',
            'pathway'    => 'nullable|string|max:150',
            'config'     => 'sometimes|array',
            'is_default' => 'boolean',
        ]);

        if ($data['is_default'] ?? false) {
            ConsultantAgreementTemplate::where('consultant_id', $request->user()->id)
                ->where('id', '!=', $template->id)
                ->update(['is_default' => false]);
        }

        $updates = [];
        if (isset($data['name'])) {
            $updates['name'] = $data['name'];
        }
        if (array_key_exists('pathway', $data)) {
            $updates['pathway'] = $data['pathway'];
        }
        if (array_key_exists('is_default', $data)) {
            $updates['is_default'] = (bool) $data['is_default'];
        }
        if (isset($data['config'])) {
            $updates['config'] = $this->sanitizeTemplateConfig($data['config']);
        }

        $template->update($updates);

        return response()->json(['template' => $template->fresh(), 'message' => 'Template updated.']);
    }

    public function destroy(Request $request, ConsultantAgreementTemplate $template): JsonResponse
    {
        $this->authorizeTemplate($request, $template);
        $template->delete();

        return response()->json(['message' => 'Template deleted.']);
    }

    private function authorizeTemplate(Request $request, ConsultantAgreementTemplate $template): void
    {
        if ($template->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }
    }

    /** @param array<string, mixed> $config */
    private function sanitizeTemplateConfig(array $config): array
    {
        $defaults = RetainerAgreementConfig::defaults();
        $allowed  = array_keys($defaults);
        $filtered = array_intersect_key($config, array_flip($allowed));

        unset($filtered['clientName'], $filtered['clientEmail'], $filtered['consultantName']);

        return RetainerAgreementConfig::normalize($filtered, $filtered['pathway'] ?? null);
    }
}
