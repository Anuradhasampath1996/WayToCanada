<?php

namespace App\Services\Notifications;

use App\Models\CaseFile;
use App\Models\CaseMessage;
use App\Models\ClientMeeting;
use App\Models\ClientPaymentRequest;
use App\Models\ClientProfile;
use App\Models\ConsultantClientRequest;
use App\Models\DocumentSubmission;
use App\Models\Lms\LmsCourseAssignment;
use App\Models\User;
use App\Models\UserNotification;

class NotificationConsultantResolver
{
    public function resolveForNotification(UserNotification $notification): ?User
    {
        $notification->loadMissing('user.clientProfile.consultant', 'related');

        $related = $notification->related;

        if ($related instanceof CaseFile) {
            $related->loadMissing('consultant');

            return $related->consultant;
        }

        if ($related instanceof CaseMessage) {
            $related->loadMissing('caseFile.consultant');

            return $related->caseFile?->consultant;
        }

        if ($related instanceof ClientMeeting) {
            $related->loadMissing('consultant');

            return $related->consultant;
        }

        if ($related instanceof ClientPaymentRequest) {
            $related->loadMissing('consultant');

            return $related->consultant;
        }

        if ($related instanceof DocumentSubmission) {
            $related->loadMissing('caseFile.consultant');

            return $related->caseFile?->consultant;
        }

        if ($related instanceof ClientProfile) {
            $related->loadMissing('consultant');

            return $related->consultant;
        }

        if ($related instanceof ConsultantClientRequest) {
            $related->loadMissing('consultant');

            return $related->consultant;
        }

        if ($related instanceof LmsCourseAssignment) {
            $related->loadMissing('clientUser.clientProfile.consultant');

            if ($related->assigned_by_user_id) {
                return User::find($related->assigned_by_user_id)
                    ?? $related->clientUser?->clientProfile?->consultant;
            }

            return $related->clientUser?->clientProfile?->consultant;
        }

        return $notification->user?->clientProfile?->consultant;
    }
}
