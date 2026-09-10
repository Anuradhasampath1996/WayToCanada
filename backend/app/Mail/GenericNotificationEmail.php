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
        $user         = $notification->user;
        $branding     = $user
            ? app(EmailBrandingService::class)->forRecipient($user)
            : app(EmailBrandingService::class)->forPlatform();

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
