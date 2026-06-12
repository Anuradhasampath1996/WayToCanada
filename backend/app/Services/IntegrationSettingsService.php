<?php

namespace App\Services;

use App\Models\IntegrationSetting;
use Illuminate\Support\Facades\Cache;

class IntegrationSettingsService
{
    public const CACHE_KEY = 'integration_settings_runtime_v1';

    /** @var array<string, array{label: string, description: string, secrets: list<string>, fields: list<string>, env: array<string, string>}> */
    public const GROUPS = [
        'mail' => [
            'label'       => 'Email (SMTP / SES)',
            'description' => 'Transactional email for notifications, agreements, and invites.',
            'secrets'     => ['smtp_password', 'aws_secret_access_key'],
            'fields'      => [
                'mailer', 'smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_username', 'smtp_password',
                'from_address', 'from_name', 'aws_access_key_id', 'aws_secret_access_key', 'aws_region',
            ],
            'env' => [
                'mailer'               => 'MAIL_MAILER',
                'smtp_host'            => 'MAIL_HOST',
                'smtp_port'            => 'MAIL_PORT',
                'smtp_encryption'      => 'MAIL_ENCRYPTION',
                'smtp_username'        => 'MAIL_USERNAME',
                'smtp_password'        => 'MAIL_PASSWORD',
                'from_address'         => 'MAIL_FROM_ADDRESS',
                'from_name'            => 'MAIL_FROM_NAME',
                'aws_access_key_id'    => 'AWS_ACCESS_KEY_ID',
                'aws_secret_access_key'=> 'AWS_SECRET_ACCESS_KEY',
                'aws_region'           => 'AWS_DEFAULT_REGION',
            ],
        ],
        'google_oauth' => [
            'label'       => 'Google OAuth (Sign in)',
            'description' => 'Google login for clients and consultants.',
            'secrets'     => ['client_secret'],
            'fields'      => ['client_id', 'client_secret', 'redirect_uri'],
            'env'         => [
                'client_id'     => 'GOOGLE_CLIENT_ID',
                'client_secret' => 'GOOGLE_CLIENT_SECRET',
                'redirect_uri'  => 'GOOGLE_REDIRECT_URI',
            ],
        ],
        'google_meet' => [
            'label'       => 'Google Meet OAuth',
            'description' => 'Schedule Google Calendar meetings with Meet links.',
            'secrets'     => ['client_secret'],
            'fields'      => ['client_id', 'client_secret', 'redirect_uri'],
            'env'         => [
                'client_id'     => 'GOOGLE_MEET_CLIENT_ID',
                'client_secret' => 'GOOGLE_MEET_CLIENT_SECRET',
                'redirect_uri'  => 'GOOGLE_MEET_REDIRECT_URI',
            ],
        ],
        'twilio' => [
            'label'       => 'Twilio WhatsApp',
            'description' => 'WhatsApp notifications and agreement reminders.',
            'secrets'     => ['auth_token'],
            'fields'      => ['account_sid', 'auth_token', 'whatsapp_from'],
            'env'         => [
                'account_sid'   => 'TWILIO_ACCOUNT_SID',
                'auth_token'    => 'TWILIO_AUTH_TOKEN',
                'whatsapp_from' => 'TWILIO_WHATSAPP_FROM',
            ],
        ],
        'zoom' => [
            'label'       => 'Zoom OAuth',
            'description' => 'Schedule Zoom meetings from client workspace.',
            'secrets'     => ['client_secret'],
            'fields'      => ['client_id', 'client_secret', 'redirect_uri'],
            'env'         => [
                'client_id'     => 'ZOOM_CLIENT_ID',
                'client_secret' => 'ZOOM_CLIENT_SECRET',
                'redirect_uri'  => 'ZOOM_REDIRECT_URI',
            ],
        ],
        'microsoft' => [
            'label'       => 'Microsoft Teams OAuth',
            'description' => 'Schedule Microsoft Teams meetings.',
            'secrets'     => ['client_secret'],
            'fields'      => ['client_id', 'client_secret', 'redirect_uri', 'tenant_id'],
            'env'         => [
                'client_id'     => 'MICROSOFT_CLIENT_ID',
                'client_secret' => 'MICROSOFT_CLIENT_SECRET',
                'redirect_uri'  => 'MICROSOFT_REDIRECT_URI',
                'tenant_id'     => 'MICROSOFT_TENANT_ID',
            ],
        ],
        'aws_s3' => [
            'label'       => 'AWS S3 Storage',
            'description' => 'Document and file storage (Canada region recommended).',
            'secrets'     => ['secret_access_key'],
            'fields'      => ['access_key_id', 'secret_access_key', 'region', 'bucket'],
            'env'         => [
                'access_key_id'     => 'AWS_ACCESS_KEY_ID',
                'secret_access_key' => 'AWS_SECRET_ACCESS_KEY',
                'region'            => 'AWS_DEFAULT_REGION',
                'bucket'            => 'AWS_S3_BUCKET',
            ],
        ],
        'openai' => [
            'label'       => 'OpenAI',
            'description' => 'Legislation Hub AI analysis.',
            'secrets'     => ['api_key'],
            'fields'      => ['api_key', 'enabled', 'model'],
            'env'         => [
                'api_key' => 'OPENAI_API_KEY',
                'enabled' => 'LEGISLATION_OPENAI_ENABLED',
                'model'   => 'LEGISLATION_OPENAI_MODEL',
            ],
        ],
    ];

    /** @return list<array<string, mixed>> */
    public function adminIndex(): array
    {
        return collect(array_keys(self::GROUPS))->map(function (string $key) {
            $meta   = self::GROUPS[$key];
            $merged = $this->merged($key);
            $stored = IntegrationSetting::where('group_key', $key)->first();

            $values = [];
            $previews = [];
            foreach ($meta['fields'] as $field) {
                $val = $merged[$field] ?? null;
                if (in_array($field, $meta['secrets'], true)) {
                    $values[$field] = null;
                    $previews[$field] = IntegrationSetting::maskSecret(is_string($val) ? $val : null);
                } else {
                    $values[$field] = $val;
                }
            }

            return [
                'key'         => $key,
                'label'       => $meta['label'],
                'description' => $meta['description'],
                'fields'      => $meta['fields'],
                'secrets'     => $meta['secrets'],
                'values'      => $values,
                'previews'    => $previews,
                'configured'  => $this->isConfigured($key, $merged),
                'source'      => $stored?->payload ? 'database' : 'env',
                'updated_at'  => $stored?->updated_at?->toIso8601String(),
            ];
        })->values()->all();
    }

    /** @param array<string, mixed> $input */
    public function updateGroup(string $groupKey, array $input, ?int $adminUserId = null): void
    {
        if (! isset(self::GROUPS[$groupKey])) {
            throw new \InvalidArgumentException('Unknown integration group.');
        }

        $meta     = self::GROUPS[$groupKey];
        $existing = $this->stored($groupKey);
        $next     = $existing;

        foreach ($meta['fields'] as $field) {
            if (! array_key_exists($field, $input)) {
                continue;
            }

            $value = $input[$field];

            if (in_array($field, $meta['secrets'], true)) {
                if ($value === null || $value === '') {
                    continue;
                }
                $next[$field] = (string) $value;
            } else {
                $next[$field] = $value === '' ? null : $value;
            }
        }

        IntegrationSetting::updateOrCreate(
            ['group_key' => $groupKey],
            [
                'payload'    => IntegrationSetting::encryptPayload($next),
                'updated_by' => $adminUserId,
            ],
        );

        Cache::forget(self::CACHE_KEY);
    }

    public function clearGroup(string $groupKey): void
    {
        IntegrationSetting::where('group_key', $groupKey)->delete();
        Cache::forget(self::CACHE_KEY);
    }

    /** Apply DB overrides to Laravel config (cached per request boot). */
    public function applyRuntimeConfig(): void
    {
        $all = Cache::remember(self::CACHE_KEY, 300, function () {
            $out = [];
            foreach (array_keys(self::GROUPS) as $key) {
                $out[$key] = $this->merged($key);
            }

            return $out;
        });

        $this->applyMail($all['mail'] ?? []);
        $this->applyGoogleOAuth($all['google_oauth'] ?? []);
        $this->applyGoogleMeet($all['google_meet'] ?? [], $all['google_oauth'] ?? []);
        $this->applyTwilio($all['twilio'] ?? []);
        $this->applyZoom($all['zoom'] ?? []);
        $this->applyMicrosoft($all['microsoft'] ?? []);
        $this->applyAws($all['aws_s3'] ?? [], $all['mail'] ?? []);
        $this->applyOpenAi($all['openai'] ?? []);
    }

    /** @return array<string, mixed> */
    public function merged(string $groupKey): array
    {
        $meta = self::GROUPS[$groupKey] ?? null;
        if (! $meta) {
            return [];
        }

        $fromEnv = [];
        foreach ($meta['env'] as $field => $envKey) {
            $fromEnv[$field] = env($envKey);
        }

        return array_merge($fromEnv, $this->stored($groupKey));
    }

    /** @return array<string, mixed> */
    private function stored(string $groupKey): array
    {
        $row = IntegrationSetting::where('group_key', $groupKey)->first();

        return IntegrationSetting::decryptPayload($row?->payload);
    }

    /** @param array<string, mixed> $v */
    private function isConfigured(string $groupKey, array $v): bool
    {
        return match ($groupKey) {
            'mail' => ! empty($v['from_address']) && (
                ($v['mailer'] ?? '') === 'log' ||
                ($v['mailer'] ?? '') === 'array' ||
                ! empty($v['smtp_host']) ||
                ! empty($v['aws_access_key_id'])
            ),
            'google_oauth', 'google_meet', 'zoom', 'microsoft' =>
                ! empty($v['client_id']) && ! empty($v['client_secret']),
            'twilio' => ! empty($v['account_sid']) && ! empty($v['auth_token']),
            'aws_s3' => ! empty($v['access_key_id']) && ! empty($v['bucket']),
            'openai' => ! empty($v['api_key']),
            default => false,
        };
    }

    /** @param array<string, mixed> $v */
    private function applyMail(array $v): void
    {
        if (! empty($v['mailer'])) {
            config(['mail.default' => $v['mailer']]);
        }
        if (! empty($v['from_address'])) {
            config(['mail.from.address' => $v['from_address']]);
        }
        if (! empty($v['from_name'])) {
            config(['mail.from.name' => $v['from_name']]);
        }
        if (! empty($v['smtp_host'])) {
            config([
                'mail.mailers.smtp.host'       => $v['smtp_host'],
                'mail.mailers.smtp.port'       => (int) ($v['smtp_port'] ?? 587),
                'mail.mailers.smtp.username'   => $v['smtp_username'] ?? null,
                'mail.mailers.smtp.password'   => $v['smtp_password'] ?? null,
                'mail.mailers.smtp.encryption' => $v['smtp_encryption'] ?? null,
            ]);
        }
    }

    /** @param array<string, mixed> $v */
    private function applyGoogleOAuth(array $v): void
    {
        if (empty($v['client_id']) && empty($v['client_secret'])) {
            return;
        }

        config([
            'services.google.client_id'     => $v['client_id'] ?? config('services.google.client_id'),
            'services.google.client_secret' => $v['client_secret'] ?? config('services.google.client_secret'),
            'services.google.redirect'      => $v['redirect_uri'] ?? config('services.google.redirect'),
        ]);
    }

    /** @param array<string, mixed> $meet @param array<string, mixed> $googleAuth */
    private function applyGoogleMeet(array $meet, array $googleAuth): void
    {
        $clientId     = $meet['client_id'] ?? $googleAuth['client_id'] ?? null;
        $clientSecret = $meet['client_secret'] ?? $googleAuth['client_secret'] ?? null;

        if (! $clientId && ! $clientSecret) {
            return;
        }

        config([
            'services.google_meet.client_id'     => $clientId,
            'services.google_meet.client_secret' => $clientSecret,
            'services.google_meet.redirect_uri'  => $meet['redirect_uri'] ?? config('services.google_meet.redirect_uri'),
        ]);
    }

    /** @param array<string, mixed> $v */
    private function applyTwilio(array $v): void
    {
        if (empty($v['account_sid'])) {
            return;
        }

        config([
            'services.twilio.sid'           => $v['account_sid'],
            'services.twilio.token'         => $v['auth_token'] ?? config('services.twilio.token'),
            'services.twilio.whatsapp_from' => $v['whatsapp_from'] ?? config('services.twilio.whatsapp_from'),
        ]);
    }

    /** @param array<string, mixed> $v */
    private function applyZoom(array $v): void
    {
        if (empty($v['client_id'])) {
            return;
        }

        config([
            'services.zoom.client_id'     => $v['client_id'],
            'services.zoom.client_secret' => $v['client_secret'] ?? config('services.zoom.client_secret'),
            'services.zoom.redirect_uri'  => $v['redirect_uri'] ?? config('services.zoom.redirect_uri'),
        ]);
    }

    /** @param array<string, mixed> $v */
    private function applyMicrosoft(array $v): void
    {
        if (empty($v['client_id'])) {
            return;
        }

        config([
            'services.microsoft.client_id'     => $v['client_id'],
            'services.microsoft.client_secret' => $v['client_secret'] ?? config('services.microsoft.client_secret'),
            'services.microsoft.redirect_uri'  => $v['redirect_uri'] ?? config('services.microsoft.redirect_uri'),
            'services.microsoft.tenant'        => $v['tenant_id'] ?? config('services.microsoft.tenant', 'common'),
        ]);
    }

    /** @param array<string, mixed> $s3 @param array<string, mixed> $mail */
    private function applyAws(array $s3, array $mail): void
    {
        $key    = $s3['access_key_id'] ?? $mail['aws_access_key_id'] ?? null;
        $secret = $s3['secret_access_key'] ?? $mail['aws_secret_access_key'] ?? null;
        $region = $s3['region'] ?? $mail['aws_region'] ?? null;

        if ($key) {
            config([
                'services.aws.key'    => $key,
                'services.aws.secret' => $secret ?? config('services.aws.secret'),
                'services.aws.region' => $region ?? config('services.aws.region'),
            ]);
            config([
                'filesystems.disks.s3.key'    => $key,
                'filesystems.disks.s3.secret' => $secret ?? config('filesystems.disks.s3.secret'),
                'filesystems.disks.s3.region' => $region ?? config('filesystems.disks.s3.region'),
            ]);
        }

        if (! empty($s3['bucket'])) {
            config(['filesystems.disks.s3.bucket' => $s3['bucket']]);
        }
    }

    /** @param array<string, mixed> $v */
    private function applyOpenAi(array $v): void
    {
        if (empty($v['api_key'])) {
            return;
        }

        config([
            'services.openai.key' => $v['api_key'],
        ]);
    }
}
