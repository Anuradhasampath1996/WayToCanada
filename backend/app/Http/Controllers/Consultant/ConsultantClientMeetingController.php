<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Mail\ClientMeetingInviteEmail;
use App\Models\CaseFile;
use App\Models\ClientMeeting;
use App\Models\ClientProfile;
use App\Services\ClientMeetingService;
use App\Services\Meetings\MeetingAvailabilityService;
use App\Services\Meetings\MeetingSchedulerService;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\Notifications\WorkspaceNotificationTriggers;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ConsultantClientMeetingController extends Controller
{
    public function __construct(
        private ClientMeetingService $meetings,
        private MeetingSchedulerService $scheduler,
        private MeetingAvailabilityService $availability,
        private WorkspaceNotificationTriggers $notify,
        private ClientActivityTriggers $activity,
    ) {}

    public function index(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->meetings->authorizeConsultant($request->user(), $profile);

        $items = ClientMeeting::where('client_profile_id', $profile->id)
            ->orderByDesc('scheduled_at')
            ->get()
            ->map(fn ($m) => $this->format($m));

        return response()->json(['data' => $items]);
    }

    public function availability(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->meetings->authorizeConsultant($request->user(), $profile);

        $data = $request->validate([
            'from'     => 'required|date',
            'to'       => 'required|date|after:from',
            'timezone' => 'nullable|string|max:64',
        ]);

        $timezone = $data['timezone'] ?? 'America/Toronto';
        $from     = Carbon::parse($data['from'], $timezone);
        $to       = Carbon::parse($data['to'], $timezone);
        $account  = $this->meetings->meetingAccountFor($request->user());

        return response()->json(
            $this->availability->getBusyPeriods($request->user(), $profile, $account, $from, $to, $timezone)
        );
    }

    public function store(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->meetings->authorizeConsultant($request->user(), $profile);

        $data = $request->validate([
            'title'            => 'required|string|max:200',
            'description'      => 'nullable|string|max:2000',
            'scheduled_at'     => 'required|date',
            'duration_minutes' => 'nullable|integer|min:15|max:480',
            'timezone'         => 'nullable|string|max:64',
            'provider'         => 'nullable|in:google_meet,zoom,teams',
            'send_email'       => 'nullable|boolean',
        ]);

        $account  = $this->meetings->meetingAccountFor($request->user());
        $provider = $data['provider'] ?? $account->preferred_provider ?? 'google_meet';

        if (! $this->scheduler->isReadyFor($account, $provider)) {
            $label = match ($provider) {
                'google_meet' => 'Google account',
                'zoom'        => 'Zoom account',
                'teams'       => 'Microsoft Teams account',
                default       => 'video account',
            };

            return response()->json([
                'message' => "Connect your {$label} in Account → Video meetings before scheduling.",
            ], 422);
        }

        $timezone = $data['timezone'] ?? 'America/Toronto';
        $startLocal  = Carbon::parse($data['scheduled_at'], $timezone);
        $scheduledAt = $startLocal->copy()->utc();

        if ($scheduledAt->isPast()) {
            return response()->json(['message' => 'Meeting time must be in the future.'], 422);
        }

        $durationMinutes = (int) ($data['duration_minutes'] ?? 60);

        if ($this->availability->conflicts(
            $request->user(),
            $profile,
            $account,
            $startLocal,
            $durationMinutes,
            $timezone,
        )) {
            return response()->json([
                'message' => 'This time overlaps an existing client meeting or your Google Calendar. Pick another slot on the calendar.',
            ], 422);
        }

        try {
            $scheduled = $this->scheduler->schedule(
                $account,
                $provider,
                $data['title'],
                $data['description'] ?? null,
                $scheduledAt,
                $data['duration_minutes'] ?? 60,
                $timezone,
            );
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $caseFile = CaseFile::firstOrCreate(
            ['client_profile_id' => $profile->id],
            ['consultant_id' => $request->user()->id, 'status' => 'PENDING_ASSESSMENT']
        );

        $meeting = ClientMeeting::create([
            'case_file_id'      => $caseFile->id,
            'client_profile_id' => $profile->id,
            'consultant_id'     => $request->user()->id,
            'title'             => $data['title'],
            'description'       => $data['description'] ?? null,
            'scheduled_at'      => $scheduledAt,
            'duration_minutes'  => $data['duration_minutes'] ?? 60,
            'timezone'          => $timezone,
            'provider'          => $provider,
            'meeting_url'       => $scheduled['meeting_url'],
            'external_meeting_id' => $scheduled['external_id'],
            'calendar_event_id' => $scheduled['calendar_event_id'],
            'status'            => 'scheduled',
            'sent_at'           => now(),
        ]);

        $profile->load('user');

        if ($request->boolean('send_email', true) && $profile->user?->email) {
            Mail::to($profile->user->email)
                ->send(new ClientMeetingInviteEmail($profile, $meeting, $request->user()));
        }

        $this->notify->onMeetingScheduled($profile, $meeting, $request->user());
        $this->activity->onMeetingScheduled($profile, $meeting, $request->user(), $request);

        return response()->json($this->format($meeting), 201);
    }

    public function cancel(Request $request, ClientProfile $profile, ClientMeeting $meeting): JsonResponse
    {
        $this->meetings->authorizeConsultant($request->user(), $profile);
        $this->authorizeMeeting($profile, $meeting);

        if ($meeting->status === 'cancelled') {
            return response()->json($this->format($meeting));
        }

        $meeting->update([
            'status'       => 'cancelled',
            'cancelled_at' => now(),
        ]);

        $profile->load('user');
        $this->notify->onMeetingCancelled($profile, $meeting->fresh(), $request->user());
        $this->activity->onMeetingCancelled($profile, $meeting->fresh(), $request->user(), $request);

        return response()->json($this->format($meeting->fresh()));
    }

    public function resend(Request $request, ClientProfile $profile, ClientMeeting $meeting): JsonResponse
    {
        $this->meetings->authorizeConsultant($request->user(), $profile);
        $this->authorizeMeeting($profile, $meeting);

        if ($meeting->status !== 'scheduled') {
            return response()->json(['message' => 'Only scheduled meetings can be resent.'], 422);
        }

        $profile->load('user');

        if ($profile->user?->email) {
            Mail::to($profile->user->email)
                ->send(new ClientMeetingInviteEmail($profile, $meeting, $request->user()));
        }

        $meeting->update(['sent_at' => now()]);

        return response()->json([
            'message' => 'Meeting invite sent.',
            'data'    => $this->format($meeting->fresh()),
        ]);
    }

    private function authorizeMeeting(ClientProfile $profile, ClientMeeting $meeting): void
    {
        if ((int) $meeting->client_profile_id !== (int) $profile->id) {
            abort(404);
        }
    }

    private function format(ClientMeeting $meeting): array
    {
        return [
            'id'               => $meeting->id,
            'title'            => $meeting->title,
            'description'      => $meeting->description,
            'scheduled_at'     => $meeting->scheduled_at->toIso8601String(),
            'scheduled_local'  => $meeting->scheduled_at->timezone($meeting->timezone)->toIso8601String(),
            'duration_minutes' => $meeting->duration_minutes,
            'timezone'         => $meeting->timezone,
            'provider'         => $meeting->provider,
            'meeting_url'      => $meeting->meeting_url,
            'invite_url'       => $meeting->publicUrl(),
            'status'           => $meeting->status,
            'sent_at'          => $meeting->sent_at?->toIso8601String(),
            'created_at'       => $meeting->created_at?->toIso8601String(),
        ];
    }
}
