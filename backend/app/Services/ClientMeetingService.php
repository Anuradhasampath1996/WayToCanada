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
        if ((int) $profile->consultant_id !== (int) $user->id) {
            abort(403, 'You do not manage this client.');
        }
    }

    public function isReadyFor(ConsultantMeetingAccount $account, string $provider): bool
    {
        return $this->scheduler->isReadyFor($account, $provider);
    }
}
