<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Support\ClientDocumentStorage;
use App\Support\QuestionnaireDocumentResolver;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\Notifications\WorkspaceNotificationTriggers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class QuestionnaireController extends Controller
{
    public function __construct(
        private WorkspaceNotificationTriggers $notify,
        private ClientActivityTriggers $activity,
    ) {}
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

        $wasSubmitted = $submission->is_submitted;

        if (! $submission->is_submitted) {
            $submission->update([
                'is_submitted' => true,
                'submitted_at' => now(),
            ]);
        }

        if (! $wasSubmitted) {
            $profile = ClientProfile::where('user_id', $request->user()->id)->first();
            if ($profile?->consultant_id) {
                $consultant = $profile->consultant;
                if ($consultant) {
                    $this->notify->onQuestionnaireSubmitted($request->user(), $consultant, $profile->id);
                    $this->activity->onQuestionnaireSubmitted($profile, $request->user(), $request);
                }
            }
        }

        return response()->json(['message' => 'Questionnaire submitted successfully.']);
    }

    // ── GET /questionnaire/document/stream ─────────────────────────────────────
    // Client streams their own uploaded questionnaire document.

    public function streamDocument(Request $request): StreamedResponse
    {
        $data = $request->validate([
            'path' => 'required|string|max:500',
        ]);

        $path = $data['path'];

        $submission = QuestionnaireSubmission::where('user_id', $request->user()->id)->firstOrFail();

        $resolved = QuestionnaireDocumentResolver::resolveStoragePath($submission, $path);
        if (! $resolved) {
            abort(404, 'File not found.');
        }

        return ClientDocumentStorage::streamResponse($resolved);
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
