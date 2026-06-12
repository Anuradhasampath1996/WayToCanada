<?php

namespace App\Mail;

use App\Models\ClientMeeting;
use App\Models\ClientProfile;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ClientMeetingInviteEmail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly ClientProfile $clientProfile,
        public readonly ClientMeeting $meeting,
        public readonly User $consultant,
    ) {}

    public function envelope(): Envelope
    {
        $when = $this->meeting->scheduled_at
            ->timezone($this->meeting->timezone)
            ->format('M j, g:i A');

        return new Envelope(
            subject: "Meeting invitation: {$this->meeting->title} — {$when}",
        );
    }

    public function content(): Content
    {
        $local = $this->meeting->scheduled_at->timezone($this->meeting->timezone);

        return new Content(
            view: 'emails.client_meeting_invite',
            with: [
                'clientName'     => $this->clientProfile->user->name,
                'consultantName' => $this->consultant->name,
                'companyName'    => $this->consultant->company_name,
                'title'          => $this->meeting->title,
                'description'    => $this->meeting->description,
                'when'           => $local->format('l, F j, Y \a\t g:i A T'),
                'duration'       => $this->meeting->duration_minutes,
                'provider'       => match ($this->meeting->provider) {
                    'google_meet' => 'Google Meet',
                    'zoom'        => 'Zoom',
                    'teams'       => 'Microsoft Teams',
                    default       => $this->meeting->provider,
                },
                'meetingUrl'     => $this->meeting->meeting_url,
                'inviteUrl'      => $this->meeting->publicUrl(),
            ],
        );
    }
}
