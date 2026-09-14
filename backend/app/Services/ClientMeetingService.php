<?php

namespace App\Services;

use App\Models\ClientProfile;
use App\Models\ConsultantMeetingAccount;
use App\Models\User;
use App\Services\Meetings\MeetingSchedulerService;

class ClientMeetingService
{
    public function __construct(
        private MeetingSchedulerService $scheduler,
    ) {}

    public function meetingAccountFor(User $consultant): ConsultantMeetingAccount
    {
        return ConsultantMeetingAccount::firstOrCreate(
            ['user_id' => $consultant->id],
            ['preferred_provider' => 'google_meet']
        );
    }

    public function authorizeConsultant(User $user, ClientProfile $profile): void
    {
        app(\App\Services\Team\TeamAccess::class)->authorize($user, $profile, 'calendar.view');
    }

    public function isReadyFor(ConsultantMeetingAccount $account, string $provider): bool
    {
        return $this->scheduler->isReadyFor($account, $provider);
    }
}
