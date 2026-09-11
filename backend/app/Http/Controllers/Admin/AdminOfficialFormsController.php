<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GovernmentFormVersion;
use App\Services\GovernmentForms\GovernmentFormOfficialSyncService;
use App\Services\GovernmentForms\GovernmentFormRegistryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminOfficialFormsController extends Controller
{
    public function __construct(
        private GovernmentFormOfficialSyncService $sync,
    ) {}

    /** GET /api/v1/admin/official-forms/status */
    public function status(): JsonResponse
    {
        return response()->json($this->sync->status());
    }

    /** POST /api/v1/admin/official-forms/ensure-templates */
    public function ensureTemplates(GovernmentFormRegistryService $registry): JsonResponse
    {
        set_time_limit(300);

        $result = $registry->ensureAllActiveTemplates();

        return response()->json([
            'message' => sprintf(
                'Template ensure finished: %d restored, %d already present, %d failed.',
                $result['restored'],
                $result['already_present'],
                count($result['failed'])
            ),
            'result' => $result,
            'status' => $this->sync->status(),
        ]);
    }

    /** POST /api/v1/admin/official-forms/sync */
    public function sync(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'form_code' => ['nullable', 'string', 'max:32'],
        ]);

        $formCode = isset($validated['form_code']) ? trim((string) $validated['form_code']) : null;
        if ($formCode === '') {
            $formCode = null;
        }

        set_time_limit(300);

        $result = $this->sync->sync($formCode);

        return response()->json([
            'message' => 'Official forms check completed. New PDF hashes create draft versions — remap before activate.',
            'result' => $result,
            'status' => $this->sync->status(),
        ]);
    }

    /** POST /api/v1/admin/official-forms/{formCode}/sync */
    public function syncOne(string $formCode): JsonResponse
    {
        set_time_limit(120);

        $result = $this->sync->sync($formCode);

        return response()->json([
            'message' => 'Official form check completed for '.$formCode.'.',
            'result' => $result,
            'status' => $this->sync->statusForForm($formCode),
        ]);
    }

    /** POST /api/v1/admin/official-forms/versions/{version}/mark-verified */
    public function markVerified(GovernmentFormVersion $version): JsonResponse
    {
        $updated = $this->sync->markVerified($version);

        return response()->json([
            'message' => 'Mappings marked VERIFIED. You can now activate this version.',
            'version' => [
                'id' => $updated->id,
                'form_code' => $updated->form_code,
                'version_label' => $updated->version_label,
                'status' => $updated->status?->value,
                'mapping_status' => $updated->mapping_status?->value,
            ],
        ]);
    }

    /** POST /api/v1/admin/official-forms/versions/{version}/activate */
    public function activate(GovernmentFormVersion $version): JsonResponse
    {
        try {
            $activated = $this->sync->activate($version);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Version activated for autofill. Previous ACTIVE version (if any) was deprecated.',
            'version' => [
                'id' => $activated->id,
                'form_code' => $activated->form_code,
                'version_label' => $activated->version_label,
                'status' => $activated->status?->value,
                'mapping_status' => $activated->mapping_status?->value,
                'template_sha256' => $activated->template_sha256,
            ],
            'status' => $this->sync->statusForForm($activated->form_code),
        ]);
    }
}
