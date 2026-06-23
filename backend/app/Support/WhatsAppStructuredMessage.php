<?php

namespace App\Support;

class WhatsAppStructuredMessage
{
    public const AUDIENCE_CLIENT = 'client';

    public const AUDIENCE_CONSULTANT = 'consultant';

    private const CLIENT_NO_REPLY = 'Please do not reply to this message. Contact your consultant directly if you need help.';

    private const CONSULTANT_NO_REPLY = 'Please do not reply to this message. Open your consultant dashboard for full details.';

    public function __construct(
        public string $audience,
        public string $firstName,
        public string $title,
        public string $body,
        public ?string $actionUrl = null,
        public ?string $consultantSignature = null,
    ) {}

    public function isClient(): bool
    {
        return $this->audience === self::AUDIENCE_CLIENT;
    }

    /** @return list<string> */
    public function metaBodyParameters(): array
    {
        if ($this->isClient()) {
            return [
                $this->truncate($this->firstName),
                $this->truncate($this->consultantSignature ?: '—'),
                $this->truncate($this->title),
                $this->truncate($this->body),
                $this->truncate($this->actionUrl ?: '—'),
            ];
        }

        return [
            $this->truncate($this->firstName),
            $this->truncate($this->title),
            $this->truncate($this->body),
            $this->truncate($this->actionUrl ?: '—'),
        ];
    }

    public function metaTemplateName(): string
    {
        $key = $this->isClient() ? 'client_template' : 'consultant_template';

        return (string) config("services.whatsapp_cloud.{$key}", $this->isClient() ? 'wtc_client_alert' : 'wtc_consultant_alert');
    }

    public function toPlainText(): string
    {
        $lines = ['Hi ' . $this->firstName . ',', ''];

        if ($this->isClient() && $this->consultantSignature) {
            $lines[] = $this->consultantSignature;
            $lines[] = '';
        }

        $lines[] = $this->title;
        $lines[] = '';
        $lines[] = $this->body;

        if ($this->actionUrl) {
            $lines[] = '';
            $lines[] = $this->actionUrl;
        }

        $lines[] = '';
        $lines[] = $this->isClient() ? self::CLIENT_NO_REPLY : self::CONSULTANT_NO_REPLY;

        return implode("\n", $lines);
    }

    private function truncate(string $value, int $max = 900): string
    {
        $value = trim(preg_replace('/\s+/', ' ', $value) ?? $value);

        if (strlen($value) <= $max) {
            return $value;
        }

        return substr($value, 0, $max - 1) . '…';
    }
}
