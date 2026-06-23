<?php

namespace App\Mail;

use App\Enums\NotificationType;
use App\Models\UserNotification;
use App\Services\Email\EmailBrandingService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class GenericNotificationEmail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public UserNotification $notification) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->notification->title);
    }

    public function content(): Content
    {
        $notification = $this->notification->loadMissing('user');
        $type         = NotificationType::tryFrom($notification->type);
        $branding     = app(EmailBrandingService::class)->viewData($notification->user?->name);

        return new Content(
            view: 'emails.generic_notification',
            with: array_merge($branding, [
                'emailSubject'  => $notification->title,
                'notification'  => $notification,
                'categoryLabel' => $type?->categoryLabel(),
                'actionLabel'   => $type?->emailActionLabel() ?? 'View details',
            ]),
        );
    }
}
