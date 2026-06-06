<?php

namespace App\Http\Controllers;

use App\Models\QuestionnaireSubmission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuestionnaireController extends Controller
{
    // ── GET /questionnaire ─────────────────────────────────────────────────────
    // Load the authenticated user's saved draft (or null if none yet).

    public function show(Request $request): JsonResponse
    {
        $submission = QuestionnaireSubmission::where('user_id', $request->user()->id)->first();

        return response()->json([
            'data' => $submission,
        ]);
    }

    // ── PUT /questionnaire ─────────────────────────────────────────────────────
    // Upsert the draft — called automatically by the frontend autosave.
    // Accepts the full form state as separate JSON columns.

    public function upsert(Request $request): JsonResponse
    {
        $data = $request->validate([
            'step1_data'        => 'nullable|array',
            'main_data'         => 'nullable|array',
            'spouse_data'       => 'nullable|array',
            'children_data'     => 'nullable|array',
            'accompanying_data' => 'nullable|array',
        ]);

        $submission = QuestionnaireSubmission::updateOrCreate(
            ['user_id' => $request->user()->id],
            $data
        );

        return response()->json([
            'message' => 'Saved.',
            'data'    => $submission,
        ]);
    }

    // ── POST /questionnaire/submit ─────────────────────────────────────────────
    // Mark the draft as formally submitted. Idempotent — returns 200 even if
    // already submitted so the frontend can safely retry on network errors.

    public function submit(Request $request): JsonResponse
    {
        $submission = QuestionnaireSubmission::where('user_id', $request->user()->id)->first();

        if (! $submission) {
            return response()->json(['message' => 'No questionnaire found. Please save first.'], 422);
        }

        if (! $submission->is_submitted) {
            $submission->update([
                'is_submitted' => true,
                'submitted_at' => now(),
            ]);
        }

        return response()->json(['message' => 'Questionnaire submitted successfully.']);
    }
}
