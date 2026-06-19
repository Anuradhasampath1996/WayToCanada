<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Services\WorkspaceAiAdvisorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantWorkspaceAiAdvisorController extends Controller
{
    public function __construct(
        private WorkspaceAiAdvisorService $advisor,
    ) {}

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
                ? 'AI case analysis complete.'
                : 'Case analysis complete (rules engine). Add OPENAI_API_KEY and enable Maple workspace AI in Admin → Integrations → OpenAI.',
        ]);
    }

    /** POST /api/v1/consultant/clients/{profile}/ai-advisor/chat */
    public function chat(Request $request, ClientProfile $profile): JsonResponse
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }

        $validated = $request->validate([
            'message'           => 'required|string|max:4000',
            'history'           => 'nullable|array|max:20',
            'history.*.role'    => 'required_with:history|in:user,assistant',
            'history.*.content' => 'required_with:history|string|max:4000',
        ]);

        try {
            $data = $this->advisor->chat(
                $profile,
                $request->user(),
                $validated['message'],
                $validated['history'] ?? [],
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        return response()->json(['data' => $data, 'message' => 'Maple replied.']);
    }
}
