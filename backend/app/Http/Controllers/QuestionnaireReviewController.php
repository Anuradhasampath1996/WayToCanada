<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Services\ClientActivity\ClientActivityTriggers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class QuestionnaireReviewController extends Controller
{
    public function __construct(
        private ClientActivityTriggers $activity,
    ) {}

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

        $this->activity->onFieldVerified($profile, $request->user(), $data['field_key'], $data['verified'], $request);

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

    // ── GET /consultant/clients/{profile}/questionnaire/document/stream ────────
    // Stream a questionnaire-uploaded file (passport, ID, etc.) from storage.
    // Query: ?path=client-document/2026/06/passport.jpg

    public function streamDocument(Request $request, ClientProfile $profile): StreamedResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'path' => 'required|string|max:500',
        ]);

        $path = $data['path'];

        if (! preg_match('#^client-document/\d{4}/\d{2}/#', $path)) {
            abort(422, 'Invalid document path.');
        }

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->firstOrFail();

        if (! $this->submissionContainsFilePath($submission, $path)) {
            abort(403, 'Document not linked to this client questionnaire.');
        }

        if (! Storage::disk('localstack')->exists($path)) {
            abort(404, 'File not found.');
        }

        $filename = basename($path);
        $mime     = Storage::disk('localstack')->mimeType($path) ?: 'application/octet-stream';
        $download = $request->boolean('download');

        return Storage::disk('localstack')->response($path, $filename, [
            'Content-Type'        => $mime,
            'Content-Disposition' => ($download ? 'attachment' : 'inline').'; filename="'.addslashes($filename).'"',
            'Cache-Control'       => 'private, max-age=3600',
        ]);
    }

    // ── PATCH /consultant/clients/{profile}/questionnaire/request-refill ───────
    // Ask the client to correct a field. Body: { field_key, remark }

    public function requestRefill(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'field_key' => 'required|string|max:200',
            'remark'    => 'required|string|max:2000',
        ]);

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->firstOrFail();

        $remarks = $submission->field_remarks ?? [];
        $remarks[$data['field_key']] = [
            'remark'       => $data['remark'],
            'requested_at' => now()->toIso8601String(),
            'status'       => 'pending',
        ];

        $verifiedFields = $submission->verified_fields ?? [];
        unset($verifiedFields[$data['field_key']]);

        $submission->update([
            'field_remarks'   => $remarks,
            'verified_fields' => $verifiedFields,
        ]);

        $this->activity->onFieldRemark($profile, $request->user(), $data['field_key'], $data['remark'], $request);

        return response()->json([
            'message'         => 'Refill requested. The client will see your remark.',
            'field_remarks'   => $remarks,
            'verified_fields' => $verifiedFields,
        ]);
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private function submissionContainsFilePath(QuestionnaireSubmission $submission, string $filePath): bool
    {
        return $this->arrayContainsValue($submission->step1_data, $filePath)
            || $this->arrayContainsValue($submission->main_data, $filePath)
            || $this->arrayContainsValue($submission->spouse_data, $filePath)
            || $this->arrayContainsValue($submission->children_data, $filePath)
            || $this->arrayContainsValue($submission->accompanying_data, $filePath);
    }

    private function arrayContainsValue(mixed $data, string $needle): bool
    {
        if (! is_array($data)) {
            return false;
        }

        foreach ($data as $value) {
            if (is_string($value) && $value === $needle) {
                return true;
            }
            if (is_array($value) && $this->arrayContainsValue($value, $needle)) {
                return true;
            }
        }

        return false;
    }
}
