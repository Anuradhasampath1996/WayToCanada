<?php

namespace App\Services\Meetings;

use App\Models\ConsultantMeetingAccount;
use App\Support\MeetingOAuthTokens;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;

class TeamsMeetingIntegrationService
{
    public function isConfigured(): bool
    {
        return (bool) (config('services.microsoft.client_id') && config('services.microsoft.client_secret'));
    }

    public function authorizeUrl(string $state): string
    {
        $tenant = config('services.microsoft.tenant', 'common');
        $params = http_build_query([
            'client_id'     => config('services.microsoft.client_id'),
            'response_type' => 'code',
            'redirect_uri'  => config('services.microsoft.redirect_uri'),
            'response_mode' => 'query',
            'scope'         => 'openid profile email offline_access OnlineMeetings.ReadWrite',
            'state'         => $state,
        ]);

        return "https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/authorize?" . $params;
    }

    public function handleCallback(string $code): array
    {
        $tenant = config('services.microsoft.tenant', 'common');

        $response = Http::asForm()->post("https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/token", [
            'client_id'     => config('services.microsoft.client_id'),
            'client_secret' => config('services.microsoft.client_secret'),
            'code'          => $code,
            'redirect_uri'  => config('services.microsoft.redirect_uri'),
            'grant_type'    => 'authorization_code',
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Microsoft Teams authorization failed.');
        }

        $data  = $response->json();
        $email = $this->fetchEmail($data['access_token']);

        return [
            'email'         => $email,
            'access_token'  => $data['access_token'],
            'refresh_token' => $data['refresh_token'] ?? null,
            'expires_at'    => now()->addSeconds((int) ($data['expires_in'] ?? 3600)),
        ];
    }

    public function storeTokens(ConsultantMeetingAccount $account, array $tokens): void
    {
        $account->update([
            'teams_account_email'    => $tokens['email'],
            'teams_access_token'     => MeetingOAuthTokens::encrypt($tokens['access_token']),
            'teams_refresh_token'    => MeetingOAuthTokens::encrypt($tokens['refresh_token'] ?? MeetingOAuthTokens::decrypt($account->teams_refresh_token)),
            'teams_token_expires_at' => $tokens['expires_at'],
            'teams_connected_at'     => now(),
        ]);
    }

    public function disconnect(ConsultantMeetingAccount $account): void
    {
        $account->update([
            'teams_account_email'     => null,
            'teams_access_token'      => null,
            'teams_refresh_token'     => null,
            'teams_token_expires_at'  => null,
            'teams_connected_at'      => null,
            'teams_meeting_url'       => null,
        ]);
    }

    public function isConnected(ConsultantMeetingAccount $account): bool
    {
        return (bool) ($account->teams_connected_at && ($account->teams_refresh_token || $account->teams_access_token));
    }

    /**
     * @return array{meeting_url: string, external_id: string|null, calendar_event_id: null}
     */
    public function createMeeting(
        ConsultantMeetingAccount $account,
        string $title,
        ?string $description,
        Carbon $start,
        int $durationMinutes,
        string $timezone,
    ): array {
        $token = $this->accessToken($account);
        $end   = $start->copy()->timezone($timezone)->addMinutes($durationMinutes);

        $response = Http::withToken($token)->post('https://graph.microsoft.com/v1.0/me/onlineMeetings', [
            'subject'          => $title,
            'startDateTime'    => $start->timezone($timezone)->toIso8601String(),
            'endDateTime'      => $end->toIso8601String(),
            'joinMeetingIdSettings' => [
                'isPasscodeRequired' => false,
            ],
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Could not create Teams meeting: ' . ($response->json('error.message') ?? 'unknown error'));
        }

        $meeting = $response->json();

        return [
            'meeting_url'       => $meeting['joinWebUrl'] ?? throw new \RuntimeException('Teams join URL missing.'),
            'external_id'       => $meeting['id'] ?? null,
            'calendar_event_id' => null,
        ];
    }

    private function accessToken(ConsultantMeetingAccount $account): string
    {
        if ($account->teams_token_expires_at && $account->teams_token_expires_at->isFuture()) {
            $existing = MeetingOAuthTokens::decrypt($account->teams_access_token);
            if ($existing) {
                return $existing;
            }
        }

        $refresh = MeetingOAuthTokens::decrypt($account->teams_refresh_token);
        if (! $refresh) {
            throw new \RuntimeException('Microsoft Teams disconnected. Please reconnect in Account settings.');
        }

        $tenant = config('services.microsoft.tenant', 'common');

        $response = Http::asForm()->post("https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/token", [
            'client_id'     => config('services.microsoft.client_id'),
            'client_secret' => config('services.microsoft.client_secret'),
            'refresh_token' => $refresh,
            'grant_type'    => 'refresh_token',
            'redirect_uri'  => config('services.microsoft.redirect_uri'),
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Microsoft Teams session expired. Please reconnect your account.');
        }

        $data = $response->json();
        $account->update([
            'teams_access_token'     => MeetingOAuthTokens::encrypt($data['access_token']),
            'teams_refresh_token'    => MeetingOAuthTokens::encrypt($data['refresh_token'] ?? $refresh),
            'teams_token_expires_at' => now()->addSeconds((int) ($data['expires_in'] ?? 3600)),
        ]);

        return $data['access_token'];
    }

    private function fetchEmail(string $accessToken): ?string
    {
        $response = Http::withToken($accessToken)->get('https://graph.microsoft.com/v1.0/me');

        return $response->successful()
            ? ($response->json('mail') ?? $response->json('userPrincipalName'))
            : null;
    }
}
