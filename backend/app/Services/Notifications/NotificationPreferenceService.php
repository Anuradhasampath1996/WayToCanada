<?php

namespace App\Services\Notifications;

use App\Enums\NotificationType;
use App\Models\User;
use App\Models\UserNotificationPreference;

class NotificationPreferenceService
{
    public function __construct(
        private NotificationPhoneResolver $phones,
    ) {}

    public function forUser(User $user): UserNotificationPreference
    {
        return UserNotificationPreference::firstOrCreate(
            ['user_id' => $user->id],
            $this->defaultAttributesFor($user),
        );
    }

    /** @return array<string, mixed> */
    private function defaultAttributesFor(User $user): array
    {
        $isWorkspaceUser = $user->hasAnyRole(['rcic', 'client']);

        $attributes = [
            'in_app_enabled'   => true,
            'email_enabled'    => true,
            'whatsapp_enabled' => $isWorkspaceUser,
        ];

        if ($isWorkspaceUser) {
            $phone = $user->hasRole('rcic')
                ? ($user->phone ?: $user->company_phone)
                : $this->phones->resolveForUser($user);

            if ($phone) {
                $attributes['whatsapp_phone'] = $phone;
            }
        }

        return $attributes;
    }

    /** @param list<string> $channels */
    public function filterChannels(User $user, NotificationType $type, array $channels): array
    {
        $prefs = $this->forUser($user);
        $category = $type->category();
        $catPrefs = $prefs->category_preferences[$category] ?? null;

        return array_values(array_filter($channels, function (string $channel) use ($prefs, $catPrefs) {
            if ($channel === 'in_app') {
                if ($catPrefs !== null && array_key_exists('in_app', $catPrefs)) {
                    return (bool) $catPrefs['in_app'];
                }

                return $prefs->in_app_enabled;
            }

            if ($channel === 'email') {
                if ($catPrefs !== null && array_key_exists('email', $catPrefs)) {
                    return (bool) $catPrefs['email'];
                }

                return $prefs->email_enabled;
            }

            if ($channel === 'whatsapp') {
                if (! $prefs->whatsapp_enabled) {
                    return false;
                }
                if ($catPrefs !== null && array_key_exists('whatsapp', $catPrefs)) {
                    return (bool) $catPrefs['whatsapp'];
                }

                return true;
            }

            return false;
        }));
    }
}
