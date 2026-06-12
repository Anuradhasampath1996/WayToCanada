<?php

namespace App\Services\Notifications;

use App\Enums\NotificationType;
use App\Models\AdminBroadcast;
use App\Models\User;
use Spatie\Permission\Models\Role;

class AdminBroadcastService
{
    public function __construct(
        private NotificationService $notifications,
    ) {}

    public function send(AdminBroadcast $broadcast): AdminBroadcast
    {
        $recipients = $this->resolveRecipients($broadcast);
        $channels   = $broadcast->channels ?: ['in_app', 'email'];

        foreach ($recipients as $user) {
            $this->notifications->dispatch(
                $user,
                NotificationType::ADMIN_BROADCAST,
                $broadcast->title,
                $broadcast->body,
                $broadcast->action_url,
                'admin_broadcast:' . $broadcast->id . ':user:' . $user->id,
                $broadcast,
                $channels,
            );
        }

        $broadcast->update([
            'sent_at'          => now(),
            'recipient_count'  => $recipients->count(),
        ]);

        return $broadcast->fresh();
    }

    /** @return \Illuminate\Support\Collection<int, User> */
    private function resolveRecipients(AdminBroadcast $broadcast)
    {
        if ($broadcast->target_type === 'selected' && is_array($broadcast->target_user_ids)) {
            return User::whereIn('id', $broadcast->target_user_ids)->get();
        }

        $rcicRole = Role::where('name', 'rcic')->where('guard_name', 'sanctum')->first();
        if (! $rcicRole) {
            return collect();
        }

        return User::role('rcic')->get();
    }
}
