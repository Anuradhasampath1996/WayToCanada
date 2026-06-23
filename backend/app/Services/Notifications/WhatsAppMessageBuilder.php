<?php

namespace App\Services\Notifications;

use App\Models\User;
use App\Models\UserNotification;
use App\Support\WhatsAppStructuredMessage;

class WhatsAppMessageBuilder
{
    public function __construct(
        private NotificationConsultantResolver $consultants,
    ) {}

    public function buildFromNotification(UserNotification $notification): string
    {
        return $this->buildStructuredFromNotification($notification)->toPlainText();
    }

    public function buildStructuredFromNotification(UserNotification $notification): WhatsAppStructuredMessage
    {
        $notification->loadMissing('user');
        $user = $notification->user;

        if (! $user) {
            return new WhatsAppStructuredMessage(
                WhatsAppStructuredMessage::AUDIENCE_CONSULTANT,
                'there',
                $this->stripBranding($notification->title),
                $this->stripBranding($notification->body),
                $notification->action_url,
            );
        }

        if ($user->hasRole('client')) {
            $consultant = $this->consultants->resolveForNotification($notification);

            return $this->buildStructuredForClient(
                $user->name ?? 'there',
                $consultant,
                $this->stripBranding($notification->title),
                $this->stripBranding($notification->body),
                $notification->action_url,
            );
        }

        return $this->buildStructuredForConsultant(
            $user->name ?? 'there',
            $this->stripBranding($notification->title),
            $this->stripBranding($notification->body),
            $notification->action_url,
        );
    }

    public function buildStructuredForClient(
        string $clientName,
        ?User $consultant,
        string $title,
        string $body,
        ?string $actionUrl = null,
    ): WhatsAppStructuredMessage {
        return new WhatsAppStructuredMessage(
            WhatsAppStructuredMessage::AUDIENCE_CLIENT,
            $this->firstName($clientName),
            $title,
            $body,
            $actionUrl,
            $consultant ? $this->consultantSignature($consultant) : null,
        );
    }

    public function buildStructuredForConsultant(
        string $consultantName,
        string $title,
        string $body,
        ?string $actionUrl = null,
    ): WhatsAppStructuredMessage {
        return new WhatsAppStructuredMessage(
            WhatsAppStructuredMessage::AUDIENCE_CONSULTANT,
            $this->firstName($consultantName),
            $title,
            $body,
            $actionUrl,
        );
    }

    public function buildForClient(
        string $clientName,
        ?User $consultant,
        string $title,
        string $body,
        ?string $actionUrl = null,
    ): string {
        return $this->buildStructuredForClient($clientName, $consultant, $title, $body, $actionUrl)->toPlainText();
    }

    public function buildForConsultant(
        string $consultantName,
        string $title,
        string $body,
        ?string $actionUrl = null,
    ): string {
        return $this->buildStructuredForConsultant($consultantName, $title, $body, $actionUrl)->toPlainText();
    }

    private function consultantSignature(User $consultant): string
    {
        $name = trim($consultant->name);
        $company = trim((string) ($consultant->company_name ?? ''));

        if ($company !== '') {
            return "— {$name} ({$company})";
        }

        return "— {$name}";
    }

    private function firstName(string $name): string
    {
        $name = trim($name);
        if ($name === '') {
            return 'there';
        }

        return explode(' ', $name)[0];
    }

    private function stripBranding(string $text): string
    {
        $needles = array_unique(array_filter([
            'RCICMASTER',
            'RCIC Master',
            'WayToCanada',
            'Way To Canada',
            (string) config('app.name'),
            (string) env('APP_NAME', ''),
        ]));

        foreach ($needles as $needle) {
            $text = str_ireplace($needle, '', $text);
        }

        $text = preg_replace('/\s{2,}/', ' ', $text) ?? $text;
        $text = preg_replace('/\s+([,.!?;:])/ ', '$1', $text) ?? $text;

        return trim($text);
    }
}
