<?php

namespace App\Services\Notifications;

use App\Enums\NotificationType;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Models\User;
use App\Support\NotificationUrlBuilder;
use Illuminate\Support\Str;

class SupportTicketNotificationTriggers
{
    public function __construct(
        private NotificationService $notifications,
    ) {}

    public function onCreated(SupportTicket $ticket): void
    {
        $ticket->loadMissing('consultant:id,name');
        $consultantName = $ticket->consultant?->name ?? 'A consultant';
        $preview        = Str::limit($ticket->subject, 80);
        $categoryLabel  = $this->categoryLabel($ticket->category);

        User::role(['super-admin', 'admin'])
            ->select('id')
            ->chunkById(50, function ($admins) use ($ticket, $consultantName, $preview, $categoryLabel) {
                foreach ($admins as $admin) {
                    $this->notifications->dispatch(
                        $admin,
                        NotificationType::SUPPORT_TICKET_CREATED,
                        'New consultant support request',
                        "{$consultantName} ({$categoryLabel}): {$preview}",
                        NotificationUrlBuilder::adminSupportTickets($ticket->id),
                        "support_ticket:{$ticket->id}:created:admin:{$admin->id}",
                        $ticket,
                    );
                }
            });
    }

    public function onMessage(SupportTicketMessage $message): void
    {
        $message->loadMissing('author:id,name', 'ticket:id,user_id,subject,status');
        $ticket = $message->ticket;
        if (! $ticket) {
            return;
        }

        $preview = Str::limit($message->body, 120);

        if ($message->sender_role === SupportTicketMessage::ROLE_ADMIN) {
            $consultant = User::find($ticket->user_id);
            if (! $consultant) {
                return;
            }

            $adminName = $message->author?->name ?? 'Support team';

            $this->notifications->dispatch(
                $consultant,
                NotificationType::SUPPORT_TICKET_REPLY,
                'Reply on your support request',
                "{$adminName} replied on \"{$ticket->subject}\": {$preview}",
                NotificationUrlBuilder::consultantSupportTickets($ticket->id),
                "support_ticket:{$message->id}:reply:consultant:{$consultant->id}",
                $message,
            );

            return;
        }

        User::role(['super-admin', 'admin'])
            ->select('id')
            ->chunkById(50, function ($admins) use ($ticket, $message, $preview) {
                $consultantName = $message->author?->name ?? 'Consultant';
                foreach ($admins as $admin) {
                    $this->notifications->dispatch(
                        $admin,
                        NotificationType::SUPPORT_TICKET_REPLY,
                        'Consultant replied on support ticket',
                        "{$consultantName} on \"{$ticket->subject}\": {$preview}",
                        NotificationUrlBuilder::adminSupportTickets($ticket->id),
                        "support_ticket:{$message->id}:reply:admin:{$admin->id}",
                        $message,
                    );
                }
            });
    }

    public function onClosed(SupportTicket $ticket): void
    {
        $consultant = User::find($ticket->user_id);
        if (! $consultant) {
            return;
        }

        $this->notifications->dispatch(
            $consultant,
            NotificationType::SUPPORT_TICKET_CLOSED,
            'Support request closed',
            "Your request \"{$ticket->subject}\" has been marked as resolved.",
            NotificationUrlBuilder::consultantSupportTickets($ticket->id),
            "support_ticket:{$ticket->id}:closed:{$consultant->id}",
            $ticket,
        );
    }

    private function categoryLabel(string $category): string
    {
        return match ($category) {
            SupportTicket::CATEGORY_BUG        => 'Bug',
            SupportTicket::CATEGORY_WRONG_FLOW => 'Wrong flow',
            SupportTicket::CATEGORY_FEATURE    => 'Feature request',
            default                            => 'Other',
        };
    }
}
