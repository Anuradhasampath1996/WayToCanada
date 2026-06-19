<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Services\Notifications\SupportTicketNotificationTriggers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminSupportTicketController extends Controller
{
    public function __construct(
        private SupportTicketNotificationTriggers $ticketNotifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = SupportTicket::query()
            ->with(['consultant:id,name,email,rcic_number'])
            ->withCount('messages')
            ->latest();

        $status = $request->query('status', 'open');
        if ($status !== 'all' && in_array($status, [SupportTicket::STATUS_OPEN, SupportTicket::STATUS_CLOSED], true)) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->query('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('subject', 'ilike', "%{$search}%")
                    ->orWhere('body', 'ilike', "%{$search}%")
                    ->orWhereHas('consultant', fn ($c) => $c->where('name', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%"));
            });
        }

        $paginated = $query->paginate(min((int) $request->query('per_page', 30), 100));
        $paginated->getCollection()->transform(fn (SupportTicket $t) => $this->formatTicketSummary($t));

        return response()->json($paginated);
    }

    public function show(SupportTicket $ticket): JsonResponse
    {
        $ticket->load(['consultant:id,name,email,rcic_number,company_name']);

        $messages = $ticket->messages()
            ->with('author:id,name,email')
            ->oldest()
            ->get()
            ->map(fn (SupportTicketMessage $m) => $this->formatMessage($m));

        return response()->json([
            'data' => [
                'ticket'   => $this->formatTicketDetail($ticket),
                'messages' => $messages,
            ],
        ]);
    }

    public function storeMessage(Request $request, SupportTicket $ticket): JsonResponse
    {
        if (! $ticket->isOpen()) {
            return response()->json(['message' => 'This ticket is closed. Reopen it to reply.'], 422);
        }

        $validated = $request->validate([
            'body' => 'required|string|max:10000',
        ]);

        $message = SupportTicketMessage::create([
            'support_ticket_id' => $ticket->id,
            'user_id'           => $request->user()->id,
            'sender_role'       => SupportTicketMessage::ROLE_ADMIN,
            'body'              => $validated['body'],
        ]);

        $ticket->update(['last_reply_at' => now()]);

        $this->ticketNotifications->onMessage($message);

        return response()->json([
            'message' => 'Reply sent.',
            'data'    => $this->formatMessage($message->load('author:id,name,email')),
        ], 201);
    }

    public function update(Request $request, SupportTicket $ticket): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in([SupportTicket::STATUS_OPEN, SupportTicket::STATUS_CLOSED])],
        ]);

        $wasClosed = $ticket->status === SupportTicket::STATUS_CLOSED;
        $closing   = $validated['status'] === SupportTicket::STATUS_CLOSED && $ticket->isOpen();

        $ticket->update([
            'status'    => $validated['status'],
            'closed_at' => $validated['status'] === SupportTicket::STATUS_CLOSED ? now() : null,
            'closed_by' => $validated['status'] === SupportTicket::STATUS_CLOSED ? $request->user()->id : null,
        ]);

        if ($closing) {
            $this->ticketNotifications->onClosed($ticket->fresh());
        }

        return response()->json([
            'message' => $closing ? 'Ticket marked as resolved.' : ($wasClosed ? 'Ticket reopened.' : 'Ticket updated.'),
            'data'    => $this->formatTicketDetail($ticket->fresh()->load('consultant:id,name,email,rcic_number')),
        ]);
    }

    /** @return array<string, mixed> */
    private function formatTicketSummary(SupportTicket $ticket): array
    {
        return [
            'id'           => $ticket->id,
            'category'     => $ticket->category,
            'subject'      => $ticket->subject,
            'body'         => $ticket->body,
            'status'       => $ticket->status,
            'messages_count' => (int) ($ticket->messages_count ?? 0),
            'last_reply_at'  => $ticket->last_reply_at?->toIso8601String(),
            'created_at'     => $ticket->created_at?->toIso8601String(),
            'consultant'   => [
                'id'          => $ticket->consultant?->id,
                'name'        => $ticket->consultant?->name,
                'email'       => $ticket->consultant?->email,
                'rcic_number' => $ticket->consultant?->rcic_number,
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function formatTicketDetail(SupportTicket $ticket): array
    {
        return array_merge($this->formatTicketSummary($ticket), [
            'closed_at' => $ticket->closed_at?->toIso8601String(),
            'company_name' => $ticket->consultant?->company_name ?? null,
        ]);
    }

    /** @return array<string, mixed> */
    private function formatMessage(SupportTicketMessage $message): array
    {
        return [
            'id'          => $message->id,
            'body'        => $message->body,
            'sender_role' => $message->sender_role,
            'created_at'  => $message->created_at?->toIso8601String(),
            'author'      => [
                'id'    => $message->author?->id,
                'name'  => $message->author?->name,
                'email' => $message->author?->email,
            ],
        ];
    }
}
