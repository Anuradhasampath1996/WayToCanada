<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RcicLicenseVerificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User   $applicant,
        public readonly string $rcicNumber,
        public readonly string $verificationUrl,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'RCICMASTER – RCIC Licence Verification Request',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.rcic_license_verify',
        );
    }
}
