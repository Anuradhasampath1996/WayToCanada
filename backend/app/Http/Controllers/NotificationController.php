<?php

namespace App\Http\Controllers;

use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->input('per_page', 20), 50);

        $paginator = UserNotification::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'data' => $paginator->getCollection()->map(fn ($n) => $this->format($n)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $count = UserNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['count' => $count]);
    }

    public function markRead(Request $request, UserNotification $notification): JsonResponse
    {
        $this->authorizeNotification($request, $notification);

        if (! $notification->read_at) {
            $notification->update(['read_at' => now()]);
        }

        return response()->json($this->format($notification->fresh()));
    }

    public function markAllRead(Request $request): JsonResponse
    {
        UserNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    private function authorizeNotification(Request $request, UserNotification $notification): void
    {
        if ((int) $notification->user_id !== (int) $request->user()->id) {
            abort(404);
        }
    }

    private function format(UserNotification $notification): array
    {
        return [
            'id'         => $notification->id,
            'type'       => $notification->type,
            'title'      => $notification->title,
            'body'       => $notification->body,
            'action_url' => $notification->action_url,
            'read_at'    => $notification->read_at?->toIso8601String(),
            'is_unread'  => $notification->isUnread(),
            'created_at' => $notification->created_at?->toIso8601String(),
        ];
    }
}
