<?php

namespace App\Services\Notifications;

use App\Models\ClientPaymentRequest;
use Carbon\Carbon;

class PaymentReminderService
{
    public function __construct(
        private WorkspaceNotificationTriggers $triggers,
    ) {}

    public function sendDueReminders(): int
    {
        $cutoff = Carbon::now()->subDays(3);

        $requests = ClientPaymentRequest::with(['clientProfile.user', 'consultant'])
            ->where('status', 'pending')
            ->where('created_at', '<=', $cutoff)
            ->get();

        $count = 0;
        foreach ($requests as $request) {
            $profile    = $request->clientProfile;
            $consultant = $request->consultant;
            if (! $profile || ! $consultant) {
                continue;
            }

            $this->triggers->onPaymentReminder($profile, $request, $consultant);
            $count++;
        }

        return $count;
    }
}
