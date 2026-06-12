<?php

namespace App\Services\Meetings;

use App\Models\ConsultantMeetingAccount;
use App\Support\MeetingOAuthTokens;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;

class ZoomMeetingIntegrationService
{
    public function isConfigured(): bool
    {
        return (bool) (config('services.zoom.client_id') && config('services.zoom.client_secret'));
    }

    public function authorizeUrl(string $state): string
    {
        $params = http_build_query([
            'response_type' => 'code',
            'client_id'     => config('services.zoom.client_id'),
            'redirect_uri'  => config('services.zoom.redirect_uri'),
            'state'         => $state,
        ]);

        return 'https://zoom.us/oauth/authorize?' . $params;
    }

    public function handleCallback(string $code): array
    {
        $auth = base64_encode(config('services.zoom.client_id') . ':' . config('services.zoom.client_secret'));

        $response = Http::withHeaders(['Authorization' => 'Basic ' . $auth])
            ->asForm()
            ->post('https://zoom.us/oauth/token', [
                'grant_type'   => 'authorization_code',
                'code'         => $code,
                'redirect_uri' => config('services.zoom.redirect_uri'),
            ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Zoom authorization failed.');
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
            'zoom_account_email'    => $tokens['email'],
            'zoom_access_token'     => MeetingOAuthTokens::encrypt($tokens['access_token']),
            'zoom_refresh_token'    => MeetingOAuthTokens::encrypt($tokens['refresh_token'] ?? MeetingOAuthTokens::decrypt($account->zoom_refresh_token)),
            'zoom_token_expires_at' => $tokens['expires_at'],
            'zoom_connected_at'     => now(),
        ]);
    }

    public function disconnect(ConsultantMeetingAccount $account): void
    {
        $account->update([
            'zoom_account_email'      => null,
            'zoom_access_token'       => null,
            'zoom_refresh_token'      => null,
            'zoom_token_expires_at'   => null,
            'zoom_connected_at'       => null,
            'zoom_meeting_url'        => null,
        ]);
    }

    public function isConnected(ConsultantMeetingAccount $account): bool
    {
        return (bool) ($account->zoom_connected_at && ($account->zoom_refresh_token || $account->zoom_access_token));
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

        $response = Http::withToken($token)->post('https://api.zoom.us/v2/users/me/meetings', [
            'topic'      => $title,
            'type'       => 2,
            'start_time' => $start->timezone($timezone)->format('Y-m-d\TH:i:s'),
            'duration'   => $durationMinutes,
            'timezone'   => $timezone,
            'agenda'     => $description,
            'settings'   => [
                'join_before_host' => true,
                'waiting_room'     => false,
            ],
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Could not create Zoom meeting: ' . ($response->json('message') ?? 'unknown error'));
        }

        $meeting = $response->json();

        return [
            'meeting_url'       => $meeting['join_url'] ?? throw new \RuntimeException('Zoom join URL missing.'),
            'external_id'       => isset($meeting['id']) ? (string) $meeting['id'] : null,
            'calendar_event_id' => null,
        ];
    }

    private function accessToken(ConsultantMeetingAccount $account): string
    {
        if ($account->zoom_token_expires_at && $account->zoom_token_expires_at->isFuture()) {
            $existing = MeetingOAuthTokens::decrypt($account->zoom_access_token);
            if ($existing) {
                return $existing;
            }
        }

        $refresh = MeetingOAuthTokens::decrypt($account->zoom_refresh_token);
        if (! $refresh) {
            throw new \RuntimeException('Zoom account disconnected. Please reconnect in Account settings.');
        }

        $auth = base64_encode(config('services.zoom.client_id') . ':' . config('services.zoom.client_secret'));

        $response = Http::withHeaders(['Authorization' => 'Basic ' . $auth])
            ->asForm()
            ->post('https://zoom.us/oauth/token', [
                'grant_type'    => 'refresh_token',
                'refresh_token' => $refresh,
            ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Zoom session expired. Please reconnect your Zoom account.');
        }

        $data = $response->json();
        $account->update([
            'zoom_access_token'     => MeetingOAuthTokens::encrypt($data['access_token']),
            'zoom_refresh_token'    => MeetingOAuthTokens::encrypt($data['refresh_token'] ?? $refresh),
            'zoom_token_expires_at' => now()->addSeconds((int) ($data['expires_in'] ?? 3600)),
        ]);

        return $data['access_token'];
    }

    private function fetchEmail(string $accessToken): ?string
    {
        $response = Http::withToken($accessToken)->get('https://api.zoom.us/v2/users/me');

        return $response->successful() ? ($response->json('email') ?? null) : null;
    }
}
