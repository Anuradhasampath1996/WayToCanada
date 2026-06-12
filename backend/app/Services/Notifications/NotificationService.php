<?php

namespace App\Services\Notifications;

use App\Enums\NotificationType;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class NotificationService
{
    public function __construct(
        private NotificationOrchestrator $orchestrator,
    ) {}

    /**
     * @param list<string>|null $channels
     */
    public function dispatch(
        User $user,
        NotificationType $type,
        string $title,
        string $body,
        ?string $actionUrl = null,
        ?string $dedupeKey = null,
        ?Model $related = null,
        ?array $channels = null,
    ): ?UserNotification {
        if ($dedupeKey && $this->isDuplicate($user->id, $dedupeKey)) {
            return null;
        }

        $notification = UserNotification::create([
            'user_id'      => $user->id,
            'type'         => $type->value,
            'title'        => $title,
            'body'         => $body,
            'action_url'   => $actionUrl,
            'related_type' => $related ? $related->getMorphClass() : null,
            'related_id'   => $related?->getKey(),
            'dedupe_key'   => $dedupeKey,
        ]);

        $notification->setRelation('user', $user);
        $this->orchestrator->deliver($notification, $type, $channels);

        return $notification;
    }

    private function isDuplicate(int $userId, string $dedupeKey): bool
    {
        return UserNotification::where('user_id', $userId)
            ->where('dedupe_key', $dedupeKey)
            ->where('created_at', '>=', Carbon::now()->subMinutes(5))
            ->exists();
    }
}
