<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuestionnaireReviewController extends Controller
{
    // ── Private helper ─────────────────────────────────────────────────────────

    private function authorizeConsultant(Request $request, ClientProfile $profile): void
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }
    }

    // ── GET /consultant/clients/{profile}/questionnaire ────────────────────────
    // Returns the client's questionnaire submission (including verified_fields).

    public function show(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->first();

        return response()->json([
            'submission' => $submission,
        ]);
    }

    // ── PATCH /consultant/clients/{profile}/questionnaire/verify ───────────────
    // Mark a single field as verified (or un-verified).
    // Body: { field_key: "main_data.passportNumber", verified: true }

    public function verify(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'field_key' => 'required|string|max:200',
            'verified'  => 'required|boolean',
        ]);

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->firstOrFail();

        $verifiedFields = $submission->verified_fields ?? [];

        if ($data['verified']) {
            $verifiedFields[$data['field_key']] = true;
        } else {
            unset($verifiedFields[$data['field_key']]);
        }

        $submission->update(['verified_fields' => $verifiedFields]);

        return response()->json([
            'message'         => 'Field verification updated.',
            'verified_fields' => $verifiedFields,
        ]);
    }

    // ── PATCH /consultant/clients/{profile}/questionnaire/field ───────────────
    // Consultant updates (fills/edits) a specific field on behalf of the client.
    // Body: { path: "main_data.passportNumber", value: "AB1234567" }

    public function updateField(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'path'  => 'required|string|max:200',
            'value' => 'nullable',
        ]);

        // Auto-create submission if the client hasn't started one yet
        $submission = QuestionnaireSubmission::firstOrCreate(
            ['user_id' => $profile->user_id]
        );

        $parts   = explode('.', $data['path']);
        $section = array_shift($parts); // e.g. "main_data"

        $allowed = ['step1_data', 'main_data', 'spouse_data', 'children_data', 'accompanying_data'];

        if (! in_array($section, $allowed)) {
            return response()->json(['message' => 'Invalid section.'], 422);
        }

        if (in_array($section, ['children_data', 'accompanying_data'])) {
            // path format: "children_data.0.passportNumber"
            $idx         = (int) array_shift($parts);
            $field       = implode('.', $parts);
            $arr         = $submission->$section ?? [];
            $arr[$idx]   = $arr[$idx] ?? [];
            $arr[$idx][$field] = $data['value'];
            $submission->update([$section => array_values($arr)]);
        } else {
            // path format: "main_data.passportNumber"
            $field       = implode('.', $parts);
            $sectionData = $submission->$section ?? [];
            $sectionData[$field] = $data['value'];
            $submission->update([$section => $sectionData]);
        }

        return response()->json([
            'message'    => 'Field updated successfully.',
            'submission' => $submission->fresh(),
        ]);
    }
}
