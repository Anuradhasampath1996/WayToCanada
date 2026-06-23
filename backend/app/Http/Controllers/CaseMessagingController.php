<?php

namespace App\Http\Controllers;

use App\Models\CaseFile;
use App\Models\CaseMessage;
use App\Models\ClientProfile;
use App\Services\IrccInteractiveFormVerificationService;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\Notifications\WorkspaceNotificationTriggers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CaseMessagingController extends Controller
{
    public function __construct(
        private IrccInteractiveFormVerificationService $verificationService,
        private WorkspaceNotificationTriggers $notify,
        private ClientActivityTriggers $activity,
    ) {}
    /**
     * GET /api/v1/consultant/clients/{profile}/messages
     * GET /api/v1/client/messages
     */
    public function consultantIndex(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $caseFile = $profile->caseFile;
        if (! $caseFile) {
            return response()->json(['messages' => []]);
        }

        $messages = $this->getMessages($caseFile, $request->user()->id, 'consultant');

        return response()->json(['messages' => $messages]);
    }

    public function clientIndex(Request $request): JsonResponse
    {
        $profile  = $request->user()->clientProfile;
        $caseFile = $profile?->caseFile;

        if (! $caseFile) {
            return response()->json(['messages' => []]);
        }

        $this->assertClientCanReadMessages($caseFile);

        $messages = $this->getMessages($caseFile, $request->user()->id, 'client');

        return response()->json(['messages' => $messages]);
    }

    /**
     * GET /api/v1/client/messages/unread-count
     */
    public function clientUnreadCount(Request $request): JsonResponse
    {
        $caseFile = $request->user()->clientProfile?->caseFile;

        if (! $caseFile) {
            return response()->json(['count' => 0]);
        }

        $count = $caseFile->messages()
            ->where('sender_type', 'consultant')
            ->whereNull('read_at')
            ->count();

        return response()->json(['count' => $count]);
    }

    /**
     * POST /api/v1/consultant/clients/{profile}/messages
     */
    public function consultantSend(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $request->validate(['message' => 'required|string|max:5000']);

        $caseFile = $profile->caseFile;
        if (! $caseFile) {
            return response()->json(['message' => 'No case file found.'], 404);
        }

        $msg = CaseMessage::create([
            'case_file_id' => $caseFile->id,
            'sender_id'    => $request->user()->id,
            'sender_type'  => 'consultant',
            'message'      => $request->input('message'),
        ]);

        $this->notify->onNewMessage($msg, $caseFile);
        $this->activity->onMessage($msg, $caseFile, $request);

        return response()->json([
            'message' => $this->formatMessage($msg->fresh()->load('sender:id,name')),
        ], 201);
    }

    /**
     * POST /api/v1/client/messages
     */
    public function clientSend(Request $request): JsonResponse
    {
        $request->validate(['message' => 'required|string|max:5000']);

        $user     = $request->user();
        $profile  = $user->clientProfile;
        $caseFile = $profile?->caseFile;

        if (! $caseFile) {
            return response()->json(['message' => 'No case file found.'], 404);
        }

        $this->verificationService->assertCaseManagementUnlocked($caseFile);

        $msg = CaseMessage::create([
            'case_file_id' => $caseFile->id,
            'sender_id'    => $user->id,
            'sender_type'  => 'client',
            'message'      => $request->input('message'),
        ]);

        $this->notify->onNewMessage($msg, $caseFile);
        $this->activity->onMessage($msg, $caseFile, $request);

        return response()->json([
            'message' => $this->formatMessage($msg->fresh()->load('sender:id,name')),
        ], 201);
    }

    /**
     * PATCH /api/v1/consultant/clients/{profile}/messages/mark-read
     * PATCH /api/v1/client/messages/mark-read
     */
    public function consultantMarkRead(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $caseFile = $profile->caseFile;
        if ($caseFile) {
            // Mark all client messages as read
            $caseFile->messages()
                ->where('sender_type', 'client')
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
        }

        return response()->json(['ok' => true]);
    }

    public function clientMarkRead(Request $request): JsonResponse
    {
        $caseFile = $request->user()->clientProfile?->caseFile;
        if ($caseFile) {
            $this->assertClientCanReadMessages($caseFile);

            $caseFile->messages()
                ->where('sender_type', 'consultant')
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
        }

        return response()->json(['ok' => true]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private function getMessages(CaseFile $caseFile, int $userId, string $readerType): array
    {
        return $caseFile->messages()
            ->with('sender:id,name')
            ->orderBy('created_at')
            ->get()
            ->map(fn($m) => $this->formatMessage($m))
            ->all();
    }

    private function formatMessage(CaseMessage $m): array
    {
        return [
            'id'                     => $m->id,
            'sender_name'            => $m->sender?->name ?? 'Unknown',
            'sender_type'            => $m->sender_type,
            'message'                => $m->message,
            'document_submission_id' => $m->document_submission_id,
            'read_at'                => $m->read_at?->toDateTimeString(),
            'created_at'             => $m->created_at?->toDateTimeString(),
        ];
    }

    private function authorizeConsultant(Request $request, ClientProfile $profile): void
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }
    }

    /** Clients can read (and mark read) after retainer is signed; sending still requires full case hub. */
    private function assertClientCanReadMessages(CaseFile $caseFile): void
    {
        if ($caseFile->agreement_signed_at) {
            return;
        }

        $this->verificationService->assertCaseManagementUnlocked($caseFile);
    }
}
