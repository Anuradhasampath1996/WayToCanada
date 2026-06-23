<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Models\ConsultantClientAiDocument;
use App\Services\WorkspaceAiAdvisorService;
use App\Services\WorkspaceMapleDocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantWorkspaceAiAdvisorController extends Controller
{
    public function __construct(
        private WorkspaceAiAdvisorService $advisor,
        private WorkspaceMapleDocumentService $documents,
    ) {}

    /** GET /api/v1/consultant/clients/{profile}/ai-advisor/state */
    public function state(Request $request, ClientProfile $profile): JsonResponse
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        return response()->json([
            'data' => $this->advisor->state($profile, $request->user()),
        ]);
    }

    /** POST /api/v1/consultant/clients/{profile}/ai-advisor/analyze */
    public function analyze(Request $request, ClientProfile $profile): JsonResponse
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        $data = $this->advisor->analyze($profile, $request->user());

        return response()->json([
            'data'    => $data,
            'message' => $data['openai_used']
                ? 'Maple AI case analysis complete.'
                : 'Case analysis complete (rules engine). Enable Maple workspace AI in Admin → Integrations → OpenAI for richer insights.',
        ]);
    }

    /** POST /api/v1/consultant/clients/{profile}/ai-advisor/chat */
    public function chat(Request $request, ClientProfile $profile): JsonResponse
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        $validated = $request->validate([
            'message' => 'required|string|max:4000',
        ]);

        try {
            $data = $this->advisor->chat(
                $profile,
                $request->user(),
                $validated['message'],
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        $modeLabel = ($data['intelligence_mode'] ?? '') === 'ai_enhanced'
            ? 'Maple replied (AI enhanced).'
            : 'Maple replied (rules engine — OpenAI unavailable or fell back).';

        return response()->json(['data' => $data, 'message' => $modeLabel]);
    }

    /** GET /api/v1/consultant/clients/{profile}/ai-advisor/documents */
    public function documentsIndex(Request $request, ClientProfile $profile): JsonResponse
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        return response()->json([
            'data' => $this->documents->listForWorkspace($profile, $request->user()),
        ]);
    }

    /** POST /api/v1/consultant/clients/{profile}/ai-advisor/documents */
    public function documentsUpload(Request $request, ClientProfile $profile): JsonResponse
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'mimes:pdf,png,jpg,jpeg,webp,txt,csv',
                'max:'.WorkspaceMapleDocumentService::MAX_FILE_KB,
            ],
        ]);

        try {
            $document = $this->documents->upload($profile, $request->user(), $validated['file']);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $message = ($document['status'] ?? '') === 'ready'
            ? 'Document attached — Maple can answer questions about it.'
            : ($document['error_message'] ?? 'File saved but text could not be extracted.');

        return response()->json(['data' => $document, 'message' => $message], 201);
    }

    /** DELETE /api/v1/consultant/clients/{profile}/ai-advisor/documents/{document} */
    public function documentsDestroy(
        Request $request,
        ClientProfile $profile,
        ConsultantClientAiDocument $document,
    ): JsonResponse {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        $this->documents->delete($profile, $request->user(), $document);

        return response()->json(['message' => 'Document removed from Maple.']);
    }
}
