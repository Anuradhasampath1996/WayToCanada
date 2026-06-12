<?php

namespace App\Services\Meetings;

use App\Models\ClientMeeting;
use App\Models\ClientProfile;
use App\Models\ConsultantMeetingAccount;
use App\Models\User;
use Carbon\Carbon;

class MeetingAvailabilityService
{
    public function __construct(
        private GoogleMeetIntegrationService $google,
    ) {}

    /**
     * @return array{
     *   timezone: string,
     *   google_connected: bool,
     *   busy: list<array{start: string, end: string, source: string, title: string|null}>
     * }
     */
    public function getBusyPeriods(
        User $consultant,
        ClientProfile $profile,
        ConsultantMeetingAccount $account,
        Carbon $from,
        Carbon $to,
        string $timezone,
    ): array {
        $busy = [];

        $clientMeetings = ClientMeeting::where('client_profile_id', $profile->id)
            ->where('status', 'scheduled')
            ->where('scheduled_at', '>=', $from->copy()->utc()->subDay())
            ->where('scheduled_at', '<=', $to->copy()->utc()->addDay())
            ->orderBy('scheduled_at')
            ->get();

        foreach ($clientMeetings as $meeting) {
            $start = $meeting->scheduled_at->copy()->timezone($timezone);
            $end   = $start->copy()->addMinutes($meeting->duration_minutes);

            if (! $start->lt($to) || ! $end->gt($from)) {
                continue;
            }

            $busy[] = [
                'start'  => $start->toIso8601String(),
                'end'    => $end->toIso8601String(),
                'source' => 'client_meeting',
                'title'  => $meeting->title,
            ];
        }

        $googleConnected = $this->google->isConnected($account);

        if ($googleConnected) {
            try {
                foreach ($this->google->fetchBusyPeriods($account, $from, $to, $timezone) as $period) {
                    $busy[] = [
                        'start'  => $period['start'],
                        'end'    => $period['end'],
                        'source' => 'google_calendar',
                        'title'  => 'Busy on Google Calendar',
                    ];
                }
            } catch (\Throwable) {
                // Client meetings still returned; calendar sync is best-effort for the picker UI.
            }
        }

        usort($busy, fn (array $a, array $b) => strcmp($a['start'], $b['start']));

        return [
            'timezone'         => $timezone,
            'google_connected' => $googleConnected,
            'busy'             => $busy,
        ];
    }

    public function conflicts(
        User $consultant,
        ClientProfile $profile,
        ConsultantMeetingAccount $account,
        Carbon $start,
        int $durationMinutes,
        string $timezone,
    ): bool {
        $end = $start->copy()->addMinutes($durationMinutes);

        $windowStart = $start->copy()->subHours(12);
        $windowEnd   = $end->copy()->addHours(12);

        $periods = $this->getBusyPeriods($consultant, $profile, $account, $windowStart, $windowEnd, $timezone)['busy'];

        foreach ($periods as $period) {
            $busyStart = Carbon::parse($period['start']);
            $busyEnd   = Carbon::parse($period['end']);

            if ($start->lt($busyEnd) && $end->gt($busyStart)) {
                return true;
            }
        }

        return false;
    }
}
