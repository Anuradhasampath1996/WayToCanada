<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Models\User;
use App\Services\Notifications\SupportTicketNotificationTriggers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ConsultantSupportTicketController extends Controller
{
    public function __construct(
        private SupportTicketNotificationTriggers $ticketNotifications,
    ) {}

    public function unreadCount(Request $request): JsonResponse
    {
        $this->ensureConsultant($request->user());
        $userId = $request->user()->id;

        $count = SupportTicketMessage::query()
            ->where('sender_role', SupportTicketMessage::ROLE_ADMIN)
            ->whereNull('read_at')
            ->whereHas('ticket', fn ($q) => $q->where('user_id', $userId))
            ->count();

        return response()->json(['count' => $count]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureConsultant($request->user());

        $query = SupportTicket::query()
            ->where('user_id', $request->user()->id)
            ->withCount([
                'messages as unread_admin_messages_count' => fn ($q) => $q
                    ->where('sender_role', SupportTicketMessage::ROLE_ADMIN)
                    ->whereNull('read_at'),
            ])
            ->latest();

        if ($status = $request->query('status')) {
            if (in_array($status, [SupportTicket::STATUS_OPEN, SupportTicket::STATUS_CLOSED], true)) {
                $query->where('status', $status);
            }
        }

        $paginated = $query->paginate(min((int) $request->query('per_page', 20), 50));
        $paginated->getCollection()->transform(fn (SupportTicket $t) => $this->formatTicketSummary($t));

        return response()->json($paginated);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureConsultant($request->user());

        $validated = $request->validate([
            'category' => ['required', 'string', Rule::in(SupportTicket::CATEGORIES)],
            'subject'  => 'required|string|max:255',
            'body'     => 'required|string|max:10000',
        ]);

        $ticket = SupportTicket::create([
            'user_id'       => $request->user()->id,
            'category'      => $validated['category'],
            'subject'       => $validated['subject'],
            'body'          => $validated['body'],
            'status'        => SupportTicket::STATUS_OPEN,
            'last_reply_at' => now(),
        ]);

        SupportTicketMessage::create([
            'support_ticket_id' => $ticket->id,
            'user_id'           => $request->user()->id,
            'sender_role'       => SupportTicketMessage::ROLE_CONSULTANT,
            'body'              => $validated['body'],
            'read_at'           => now(),
        ]);

        $this->ticketNotifications->onCreated($ticket);

        return response()->json([
            'message' => 'Support request submitted.',
            'data'    => $this->formatTicketSummary($ticket->fresh()),
        ], 201);
    }

    public function show(Request $request, SupportTicket $ticket): JsonResponse
    {
        $this->ensureConsultant($request->user());
        $this->ensureTicketOwner($ticket, $request->user());

        $messages = $ticket->messages()
            ->with('author:id,name')
            ->oldest()
            ->get()
            ->map(fn (SupportTicketMessage $m) => $this->formatMessage($m, $request->user()->id));

        SupportTicketMessage::query()
            ->where('support_ticket_id', $ticket->id)
            ->where('sender_role', SupportTicketMessage::ROLE_ADMIN)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $ticket->load('consultant:id,name,email,rcic_number');

        return response()->json([
            'data' => [
                'ticket'   => $this->formatTicketDetail($ticket),
                'messages' => $messages,
            ],
        ]);
    }

    public function storeMessage(Request $request, SupportTicket $ticket): JsonResponse
    {
        $this->ensureConsultant($request->user());
        $this->ensureTicketOwner($ticket, $request->user());

        if (! $ticket->isOpen()) {
            return response()->json(['message' => 'This support request is closed.'], 422);
        }

        $validated = $request->validate([
            'body' => 'required|string|max:10000',
        ]);

        $message = SupportTicketMessage::create([
            'support_ticket_id' => $ticket->id,
            'user_id'           => $request->user()->id,
            'sender_role'       => SupportTicketMessage::ROLE_CONSULTANT,
            'body'              => $validated['body'],
            'read_at'           => now(),
        ]);

        $ticket->update(['last_reply_at' => now()]);

        $this->ticketNotifications->onMessage($message);

        return response()->json([
            'message' => 'Reply sent.',
            'data'    => $this->formatMessage($message->load('author:id,name'), $request->user()->id),
        ], 201);
    }

    private function ensureConsultant(User $user): void
    {
        if (! $user->hasAnyRole(['rcic', 'super-admin', 'admin'])) {
            abort(403, 'Support requests are available to registered consultants only.');
        }
    }

    private function ensureTicketOwner(SupportTicket $ticket, User $user): void
    {
        if ($ticket->user_id !== $user->id) {
            abort(404, 'Support request not found.');
        }
    }

    /** @return array<string, mixed> */
    private function formatTicketSummary(SupportTicket $ticket): array
    {
        return [
            'id'                          => $ticket->id,
            'category'                    => $ticket->category,
            'subject'                     => $ticket->subject,
            'body'                        => $ticket->body,
            'status'                      => $ticket->status,
            'unread_admin_messages_count' => (int) ($ticket->unread_admin_messages_count ?? 0),
            'last_reply_at'               => $ticket->last_reply_at?->toIso8601String(),
            'created_at'                  => $ticket->created_at?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    private function formatTicketDetail(SupportTicket $ticket): array
    {
        return array_merge($this->formatTicketSummary($ticket), [
            'closed_at' => $ticket->closed_at?->toIso8601String(),
            'consultant' => [
                'id'          => $ticket->consultant?->id,
                'name'        => $ticket->consultant?->name,
                'email'       => $ticket->consultant?->email,
                'rcic_number' => $ticket->consultant?->rcic_number,
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function formatMessage(SupportTicketMessage $message, int $viewerId): array
    {
        return [
            'id'          => $message->id,
            'body'        => $message->body,
            'sender_role' => $message->sender_role,
            'is_mine'     => $message->user_id === $viewerId,
            'read_at'     => $message->read_at?->toIso8601String(),
            'created_at'  => $message->created_at?->toIso8601String(),
            'author'      => [
                'id'   => $message->author?->id,
                'name' => $message->author?->name,
            ],
        ];
    }
}
