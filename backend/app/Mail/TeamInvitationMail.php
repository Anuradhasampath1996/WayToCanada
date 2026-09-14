<?php

namespace App\Mail;

use App\Models\ConsultantWorkspaceInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TeamInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public ConsultantWorkspaceInvitation $invitation,
        public string $acceptUrl,
        public string $firmName,
        public string $ownerName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'You have been invited to '.$this->firmName.' on RCICMASTER',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.team-invitation',
        );
    }
}
