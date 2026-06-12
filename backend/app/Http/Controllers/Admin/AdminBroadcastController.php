<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminBroadcast;
use App\Services\Notifications\AdminBroadcastService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminBroadcastController extends Controller
{
    public function __construct(
        private AdminBroadcastService $broadcasts,
    ) {}

    public function index(): JsonResponse
    {
        $items = AdminBroadcast::orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn ($b) => $this->format($b));

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'            => 'required|string|max:200',
            'body'             => 'required|string|max:5000',
            'action_url'       => 'nullable|url|max:500',
            'channels'         => 'required|array|min:1',
            'channels.*'       => 'in:in_app,email,whatsapp',
            'target_type'      => 'required|in:all_consultants,selected',
            'target_user_ids'  => 'required_if:target_type,selected|array',
            'target_user_ids.*'=> 'integer|exists:users,id',
            'send_now'         => 'sometimes|boolean',
        ]);

        $broadcast = AdminBroadcast::create([
            'admin_user_id'   => $request->user()->id,
            'title'           => $data['title'],
            'body'            => $data['body'],
            'action_url'      => $data['action_url'] ?? null,
            'channels'        => $data['channels'],
            'target_type'     => $data['target_type'],
            'target_user_ids' => $data['target_user_ids'] ?? null,
        ]);

        if ($request->boolean('send_now', true)) {
            $broadcast = $this->broadcasts->send($broadcast);
        }

        return response()->json($this->format($broadcast), 201);
    }

    public function send(Request $request, AdminBroadcast $broadcast): JsonResponse
    {
        if ($broadcast->sent_at) {
            return response()->json(['message' => 'Broadcast already sent.'], 422);
        }

        return response()->json($this->format($this->broadcasts->send($broadcast)));
    }

    private function format(AdminBroadcast $broadcast): array
    {
        return [
            'id'               => $broadcast->id,
            'title'            => $broadcast->title,
            'body'             => $broadcast->body,
            'action_url'       => $broadcast->action_url,
            'channels'         => $broadcast->channels,
            'target_type'      => $broadcast->target_type,
            'target_user_ids'  => $broadcast->target_user_ids,
            'recipient_count'  => $broadcast->recipient_count,
            'sent_at'          => $broadcast->sent_at?->toIso8601String(),
            'created_at'       => $broadcast->created_at?->toIso8601String(),
        ];
    }
}
