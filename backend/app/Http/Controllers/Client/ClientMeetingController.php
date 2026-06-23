<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\ClientMeeting;
use App\Models\ClientProfile;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientMeetingController extends Controller
{
    /**
     * GET /api/v1/client/meetings
     */
    public function index(Request $request): JsonResponse
    {
        $profile = ClientProfile::where('user_id', $request->user()->id)->first();

        if (! $profile) {
            return response()->json(['data' => []]);
        }

        $items = ClientMeeting::where('client_profile_id', $profile->id)
            ->orderBy('scheduled_at')
            ->get()
            ->map(fn (ClientMeeting $m) => $this->format($m));

        return response()->json(['data' => $items]);
    }

    private function format(ClientMeeting $meeting): array
    {
        $scheduledAt = $meeting->scheduled_at;
        $isUpcoming = $meeting->status === 'scheduled'
            && $scheduledAt
            && $scheduledAt->greaterThan(Carbon::now()->subHour());

        return [
            'id'               => $meeting->id,
            'title'            => $meeting->title,
            'description'      => $meeting->description,
            'scheduled_at'     => $scheduledAt?->toIso8601String(),
            'scheduled_local'  => $scheduledAt
                ? $scheduledAt->copy()->timezone($meeting->timezone ?? 'America/Toronto')->toIso8601String()
                : null,
            'duration_minutes' => $meeting->duration_minutes,
            'timezone'         => $meeting->timezone,
            'provider'         => $meeting->provider,
            'meeting_url'      => $meeting->meeting_url,
            'invite_url'       => $meeting->publicUrl(),
            'status'           => $meeting->status,
            'is_upcoming'      => $isUpcoming,
            'sent_at'          => $meeting->sent_at?->toIso8601String(),
            'created_at'       => $meeting->created_at?->toIso8601String(),
        ];
    }
}
