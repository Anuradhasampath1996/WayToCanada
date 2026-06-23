<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\WhatsAppConversation;
use App\Models\WhatsAppMessage;
use App\Services\WhatsApp\WhatsAppInboxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminWhatsAppInboxController extends Controller
{
    public function __construct(
        private WhatsAppInboxService $inbox,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = WhatsAppConversation::query()
            ->with(['user:id,name,email,role'])
            ->orderByDesc('last_message_at')
            ->orderByDesc('id');

        if ($search = trim((string) $request->query('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('contact_name', 'ilike', "%{$search}%")
                    ->orWhere('wa_id', 'ilike', "%{$search}%")
                    ->orWhere('last_message_preview', 'ilike', "%{$search}%")
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%"));
            });
        }

        if ($request->boolean('unread_only')) {
            $query->where('unread_count', '>', 0);
        }

        $paginated = $query->paginate(min((int) $request->query('per_page', 30), 100));
        $paginated->getCollection()->transform(fn (WhatsAppConversation $c) => $this->formatConversationSummary($c));

        return response()->json(array_merge($paginated->toArray(), [
            'meta' => [
                'total_unread' => WhatsAppConversation::query()->sum('unread_count'),
            ],
        ]));
    }

    public function show(WhatsAppConversation $conversation): JsonResponse
    {
        $conversation->load(['user:id,name,email,role']);

        $messages = $conversation->messages()
            ->with('sentBy:id,name,email')
            ->oldest()
            ->get()
            ->map(fn (WhatsAppMessage $m) => $this->formatMessage($m));

        $this->inbox->markRead($conversation);
        $conversation->refresh();

        return response()->json([
            'data' => [
                'conversation' => $this->formatConversationDetail($conversation),
                'messages'     => $messages,
            ],
        ]);
    }

    public function storeMessage(Request $request, WhatsAppConversation $conversation): JsonResponse
    {
        $validated = $request->validate([
            'body' => 'required|string|max:4096',
        ]);

        $result = $this->inbox->sendReply($conversation, $validated['body'], (int) $request->user()->id);

        if ($result['error']) {
            return response()->json(['message' => $result['error']], 422);
        }

        return response()->json([
            'message' => 'WhatsApp message sent.',
            'data'    => $this->formatMessage($result['message']),
        ], 201);
    }

    public function markRead(WhatsAppConversation $conversation): JsonResponse
    {
        $this->inbox->markRead($conversation);

        return response()->json([
            'message' => 'Conversation marked as read.',
            'data'    => $this->formatConversationSummary($conversation->fresh(['user:id,name,email,role'])),
        ]);
    }

    public function setupStatus(): JsonResponse
    {
        $merged = app(\App\Services\IntegrationSettingsService::class)->merged('whatsapp_cloud');
        $apiBase = rtrim((string) config('app.url', 'http://127.0.0.1:8000'), '/');

        return response()->json([
            'data' => [
                'webhook_url'              => $apiBase . '/api/v1/webhooks/whatsapp',
                'verify_token_configured'  => filled($merged['webhook_verify_token'] ?? null),
                'app_secret_configured'    => filled($merged['app_secret'] ?? null),
                'meta_api_configured'      => filled($merged['phone_number_id'] ?? null) && filled($merged['access_token'] ?? null),
                'last_webhook_at'          => cache()->get('whatsapp_webhook_last_received_at'),
                'conversation_count'       => WhatsAppConversation::count(),
                'is_localhost'             => str_contains($apiBase, 'localhost') || str_contains($apiBase, '127.0.0.1'),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function formatConversationSummary(WhatsAppConversation $conversation): array
    {
        return [
            'id'                   => $conversation->id,
            'wa_id'                => $conversation->wa_id,
            'display_phone'        => '+' . $conversation->wa_id,
            'contact_name'         => $conversation->contact_name,
            'last_message_at'      => $conversation->last_message_at?->toIso8601String(),
            'last_message_preview' => $conversation->last_message_preview,
            'unread_count'         => (int) $conversation->unread_count,
            'session_open'         => $conversation->hasOpenSession(),
            'session_expires_at'   => $conversation->session_expires_at?->toIso8601String(),
            'user'                 => $conversation->user ? [
                'id'    => $conversation->user->id,
                'name'  => $conversation->user->name,
                'email' => $conversation->user->email,
                'role'  => $conversation->user->role,
            ] : null,
        ];
    }

    /** @return array<string, mixed> */
    private function formatConversationDetail(WhatsAppConversation $conversation): array
    {
        return $this->formatConversationSummary($conversation);
    }

    /** @return array<string, mixed> */
    private function formatMessage(WhatsAppMessage $message): array
    {
        return [
            'id'           => $message->id,
            'direction'    => $message->direction,
            'message_type' => $message->message_type,
            'body'         => $message->body,
            'status'       => $message->status,
            'created_at'   => $message->created_at?->toIso8601String(),
            'metadata'     => $message->metadata,
            'sent_by'      => $message->sentBy ? [
                'id'    => $message->sentBy->id,
                'name'  => $message->sentBy->name,
                'email' => $message->sentBy->email,
            ] : null,
        ];
    }
}
