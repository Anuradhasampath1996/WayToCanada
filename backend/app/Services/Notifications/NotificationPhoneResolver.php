<?php

namespace App\Services\Notifications;

use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use App\Models\UserNotificationPreference;

class NotificationPhoneResolver
{
    public function resolveForUser(User $user): ?string
    {
        $prefs = UserNotificationPreference::where('user_id', $user->id)->first();
        if ($prefs?->whatsapp_phone) {
            return $prefs->whatsapp_phone;
        }

        if ($user->phone) {
            return $user->phone;
        }

        $profile = $user->clientProfile;
        if ($profile) {
            return $this->resolveForClientProfile($profile);
        }

        return null;
    }

    public function resolveForClientProfile(ClientProfile $profile): ?string
    {
        $profile->loadMissing('user');

        $phone = $profile->phone ?: $profile->user?->phone;
        if ($phone) {
            return $phone;
        }

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)
            ->latest('id')
            ->first();

        $whatsapp = $submission?->main_data['whatsapp'] ?? $submission?->step1_data['whatsapp'] ?? null;

        return is_string($whatsapp) && trim($whatsapp) !== '' ? trim($whatsapp) : null;
    }
}
