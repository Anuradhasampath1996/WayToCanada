<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Support\ClientDocumentStorage;
use App\Support\QuestionnaireDocumentResolver;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\QuestionnaireFieldRemarkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class QuestionnaireReviewController extends Controller
{
    public function __construct(
        private ClientActivityTriggers $activity,
        private QuestionnaireFieldRemarkService $fieldRemarks,
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

    // ── PATCH /consultant/clients/{profile}/questionnaire/verify-all ───────────
    // Verify all provided field keys that have values and are not pending refill.

    public function verifyAll(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = $request->validate([
            'field_keys'   => 'required|array|max:500',
            'field_keys.*' => 'string|max:200',
        ]);

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->firstOrFail();
        $verifiedFields = $submission->verified_fields ?? [];
        $remarks = $submission->field_remarks ?? [];

        $verifiedNow = [];
        $skippedFlagged = [];
        $skippedEmpty = [];
        $skippedAlready = [];

        foreach ($data['field_keys'] as $fieldKey) {
            $fieldKey = trim((string) $fieldKey);
            if ($fieldKey === '') {
                continue;
            }

            if (! empty($verifiedFields[$fieldKey])) {
                $skippedAlready[] = $fieldKey;
                continue;
            }

            $remark = $remarks[$fieldKey] ?? null;
            if (is_array($remark) && ($remark['status'] ?? '') === 'pending') {
                $skippedFlagged[] = $fieldKey;
                continue;
            }

            if (! $this->questionnaireFieldHasValue($submission, $fieldKey)) {
                $skippedEmpty[] = $fieldKey;
                continue;
            }

            $verifiedFields[$fieldKey] = true;
            $verifiedNow[] = $fieldKey;
        }

        if ($verifiedNow !== []) {
            $submission->update(['verified_fields' => $verifiedFields]);
            // Single activity entry for the bulk action
            $this->activity->onFieldVerified(
                $profile,
                $request->user(),
                'bulk:'.count($verifiedNow).'_fields',
                true,
                $request
            );
        }

        return response()->json([
            'message' => count($verifiedNow) > 0
                ? 'Verified '.count($verifiedNow).' field(s). Pending refill requests were left unchanged.'
                : 'No fields were eligible to verify.',
            'verified_fields' => $verifiedFields,
            'verified_count' => count($verifiedNow),
            'verified_keys' => $verifiedNow,
            'skipped_flagged' => $skippedFlagged,
            'skipped_empty' => $skippedEmpty,
            'skipped_already' => $skippedAlready,
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
            $verifiedFields = $submission->verified_fields ?? [];
            unset($verifiedFields[$data['path']]);
            $submission->update([
                $section => array_values($arr),
                'field_remarks' => $this->fieldRemarks->resolveIfPending($submission, $data['path']),
                'verified_fields' => $verifiedFields,
            ]);
        } else {
            // path format: "main_data.passportNumber"
            $field       = implode('.', $parts);
            $sectionData = $submission->$section ?? [];
            $sectionData[$field] = $data['value'];
            $verifiedFields = $submission->verified_fields ?? [];
            unset($verifiedFields[$data['path']]);
            $submission->update([
                $section => $sectionData,
                'field_remarks' => $this->fieldRemarks->resolveIfPending($submission, $data['path']),
                'verified_fields' => $verifiedFields,
            ]);
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

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->firstOrFail();

        $resolved = QuestionnaireDocumentResolver::resolveStoragePath($submission, $path);
        if (! $resolved) {
            abort(404, 'File not found.');
        }

        return ClientDocumentStorage::streamResponse($resolved, $request->boolean('download'));
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

        $submission = QuestionnaireSubmission::firstOrCreate(
            ['user_id' => $profile->user_id],
        );

        $remarks = $submission->field_remarks ?? [];
        $remarks[$data['field_key']] = $this->fieldRemarks->withValueAtRequest($submission, $data['field_key'], [
            'remark'       => $data['remark'],
            'requested_at' => now()->toIso8601String(),
            'status'       => 'pending',
        ]);

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

    private function questionnaireFieldHasValue(QuestionnaireSubmission $submission, string $fieldKey): bool
    {
        $parts = explode('.', $fieldKey);
        $section = array_shift($parts);
        if ($section === null || $section === '' || $parts === []) {
            return false;
        }

        $allowed = ['step1_data', 'main_data', 'spouse_data', 'children_data', 'accompanying_data', 'step3_data'];
        if (! in_array($section, $allowed, true)) {
            return false;
        }

        $value = data_get($submission->{$section} ?? null, implode('.', $parts));

        if ($value === null || $value === '') {
            return false;
        }
        if (is_bool($value)) {
            return true;
        }
        if (is_array($value)) {
            return $value !== [];
        }

        return trim((string) $value) !== '';
    }

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
