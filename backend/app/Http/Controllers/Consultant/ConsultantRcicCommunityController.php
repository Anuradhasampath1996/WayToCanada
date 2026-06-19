<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\RcicCommunityPost;
use App\Models\RcicCommunityReaction;
use App\Models\RcicCommunityReply;
use App\Models\RcicCommunityReport;
use App\Models\User;
use App\Services\Notifications\RcicCommunityNotificationTriggers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\File;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ConsultantRcicCommunityController extends Controller
{
    public function __construct(
        private RcicCommunityNotificationTriggers $communityNotifications,
    ) {}

    public function unreadCount(Request $request): JsonResponse
    {
        $this->ensureRcicConsultant($request->user());

        $user     = $request->user();
        $lastSeen = $user->rcic_community_last_seen_at;

        $query = RcicCommunityPost::query()
            ->visible()
            ->where('user_id', '!=', $user->id);

        if ($lastSeen) {
            $query->where('created_at', '>', $lastSeen);
        }

        return response()->json(['count' => $query->count()]);
    }

    public function markSeen(Request $request): JsonResponse
    {
        $this->ensureRcicConsultant($request->user());

        $request->user()->forceFill([
            'rcic_community_last_seen_at' => now(),
        ])->save();

        return response()->json(['message' => 'Community feed marked as seen.']);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureRcicConsultant($request->user());

        $query = RcicCommunityPost::query()
            ->visible()
            ->with(['author:id,name,rcic_number,company_name'])
            ->withCount(['reactions', 'replies as visible_replies_count' => fn ($q) => $q->visible()])
            ->latest();

        if ($search = trim((string) $request->query('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'ilike', "%{$search}%")
                    ->orWhere('body', 'ilike', "%{$search}%");
            });
        }

        $paginated = $query->paginate(min((int) $request->query('per_page', 15), 50));

        $userId = $request->user()->id;
        $postIds = collect($paginated->items())->pluck('id');
        $reactedIds = RcicCommunityReaction::where('user_id', $userId)
            ->whereIn('post_id', $postIds)
            ->pluck('post_id')
            ->flip();

        $paginated->getCollection()->transform(function (RcicCommunityPost $post) use ($reactedIds, $userId) {
            return $this->formatPost($post, (bool) $reactedIds->get($post->id), $userId);
        });

        return response()->json($paginated);
    }

    public function show(Request $request, RcicCommunityPost $post): JsonResponse
    {
        $this->ensureRcicConsultant($request->user());
        $this->ensurePostVisible($post);

        $post->load(['author:id,name,rcic_number,company_name']);
        $post->loadCount(['reactions']);

        $replies = $post->replies()
            ->visible()
            ->with('author:id,name,rcic_number,company_name')
            ->oldest()
            ->get()
            ->map(fn (RcicCommunityReply $reply) => $this->formatReply($reply, $request->user()->id));

        $reacted = RcicCommunityReaction::where('post_id', $post->id)
            ->where('user_id', $request->user()->id)
            ->exists();

        return response()->json([
            'data' => [
                'post'    => $this->formatPost($post, $reacted, $request->user()->id),
                'replies' => $replies,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureRcicConsultant($request->user());

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'body'  => 'required|string|max:10000',
            'file'  => [
                'nullable',
                File::types(['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'])
                    ->max(10 * 1024),
            ],
        ]);

        $attachment = $this->storeAttachment($request, $request->user()->id);

        $post = RcicCommunityPost::create([
            'user_id'           => $request->user()->id,
            'title'             => $validated['title'],
            'body'              => $validated['body'],
            'attachment_path'   => $attachment['path'] ?? null,
            'attachment_name'   => $attachment['name'] ?? null,
            'attachment_mime'   => $attachment['mime'] ?? null,
            'attachment_size'   => $attachment['size'] ?? null,
        ]);

        $post->load('author:id,name,rcic_number,company_name');

        $this->communityNotifications->onNewPost($post);

        return response()->json([
            'message' => 'Post published to RCIC Community.',
            'data'    => $this->formatPost($post, false, $request->user()->id),
        ], 201);
    }

    public function storeReply(Request $request, RcicCommunityPost $post): JsonResponse
    {
        $this->ensureRcicConsultant($request->user());
        $this->ensurePostVisible($post);

        $validated = $request->validate([
            'body' => 'required|string|max:5000',
        ]);

        $reply = DB::connection('cws')->transaction(function () use ($post, $request, $validated) {
            $reply = RcicCommunityReply::create([
                'post_id' => $post->id,
                'user_id' => $request->user()->id,
                'body'    => $validated['body'],
            ]);
            $post->increment('replies_count');

            return $reply;
        });

        $reply->load('author:id,name,rcic_number,company_name');

        $this->communityNotifications->onReply($reply);

        return response()->json([
            'message' => 'Reply posted.',
            'data'    => $this->formatReply($reply, $request->user()->id),
        ], 201);
    }

    public function toggleReaction(Request $request, RcicCommunityPost $post): JsonResponse
    {
        $this->ensureRcicConsultant($request->user());
        $this->ensurePostVisible($post);

        $validated = $request->validate([
            'reaction' => 'nullable|string|in:like,helpful',
        ]);
        $reactionType = $validated['reaction'] ?? 'like';

        $existing = RcicCommunityReaction::where('post_id', $post->id)
            ->where('user_id', $request->user()->id)
            ->first();

        $reacted          = false;
        $reactionForNotify = null;

        if ($existing) {
            if ($existing->reaction === $reactionType) {
                $existing->delete();
                $post->decrement('reactions_count');
            } else {
                $existing->update(['reaction' => $reactionType]);
                $reacted           = true;
                $reactionForNotify = $existing->fresh();
            }
        } else {
            $reactionForNotify = RcicCommunityReaction::create([
                'post_id'  => $post->id,
                'user_id'  => $request->user()->id,
                'reaction' => $reactionType,
            ]);
            $post->increment('reactions_count');
            $reacted = true;
        }

        if ($reacted && $reactionForNotify) {
            $this->communityNotifications->onReaction($reactionForNotify, true);
        }

        $post->refresh();

        return response()->json([
            'reacted'         => $reacted,
            'reactions_count' => $post->reactions_count,
        ]);
    }

    public function report(Request $request): JsonResponse
    {
        $this->ensureRcicConsultant($request->user());

        $validated = $request->validate([
            'type'   => 'required|string|in:post,reply',
            'id'     => 'required|integer|min:1',
            'reason' => 'required|string|max:2000',
        ]);

        if ($validated['type'] === RcicCommunityReport::TYPE_POST) {
            $target = RcicCommunityPost::visible()->findOrFail($validated['id']);
        } else {
            $target = RcicCommunityReply::visible()->findOrFail($validated['id']);
        }

        $exists = RcicCommunityReport::where('reporter_id', $request->user()->id)
            ->where('reportable_type', $validated['type'])
            ->where('reportable_id', $validated['id'])
            ->where('status', 'pending')
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'You already reported this content.'], 422);
        }

        $report = RcicCommunityReport::create([
            'reporter_id'     => $request->user()->id,
            'reportable_type' => $validated['type'],
            'reportable_id'   => $validated['id'],
            'reason'          => $validated['reason'],
            'status'          => 'pending',
        ]);

        $this->communityNotifications->onReport($report);

        return response()->json(['message' => 'Report submitted. Our team will review it.']);
    }

    public function destroyPost(Request $request, RcicCommunityPost $post): JsonResponse
    {
        $this->ensureRcicConsultant($request->user());

        if ($post->user_id !== $request->user()->id) {
            abort(403, 'You can only delete your own posts.');
        }

        $this->deleteAttachment($post);
        $post->delete();

        return response()->json(['message' => 'Post removed.']);
    }

    public function downloadAttachment(Request $request, RcicCommunityPost $post): StreamedResponse|JsonResponse
    {
        $this->ensureRcicConsultant($request->user());
        $this->ensurePostVisible($post);

        if (! $post->attachment_path || ! Storage::disk('local')->exists($post->attachment_path)) {
            return response()->json(['message' => 'Attachment not found.'], 404);
        }

        return Storage::disk('local')->download(
            $post->attachment_path,
            $post->attachment_name ?? 'attachment',
        );
    }

    private function ensureRcicConsultant(User $user): void
    {
        if (! $user->hasAnyRole(['rcic', 'super-admin', 'admin'])) {
            abort(403, 'RCIC Community is available to registered consultants only.');
        }
    }

    private function ensurePostVisible(RcicCommunityPost $post): void
    {
        if ($post->is_hidden) {
            abort(404, 'Post not found.');
        }
    }

    /** @return array{path?: string, name?: string, mime?: string, size?: int} */
    private function storeAttachment(Request $request, int $userId): array
    {
        if (! $request->hasFile('file')) {
            return [];
        }

        $file = $request->file('file');
        $path = $file->store("rcic-community/{$userId}/".now()->format('Y/m'), 'local');

        return [
            'path' => $path,
            'name' => $file->getClientOriginalName(),
            'mime' => $file->getMimeType(),
            'size' => $file->getSize(),
        ];
    }

    private function deleteAttachment(RcicCommunityPost $post): void
    {
        if ($post->attachment_path && Storage::disk('local')->exists($post->attachment_path)) {
            Storage::disk('local')->delete($post->attachment_path);
        }
    }

  /** @return array<string, mixed> */
    private function formatPost(RcicCommunityPost $post, bool $reacted, ?int $viewerId = null): array
    {
        return [
            'id'              => $post->id,
            'title'           => $post->title,
            'body'            => $post->body,
            'reactions_count' => $post->reactions_count,
            'replies_count'   => $post->replies_count,
            'has_attachment'  => (bool) $post->attachment_path,
            'attachment_name' => $post->attachment_name,
            'attachment_mime' => $post->attachment_mime,
            'attachment_size' => $post->attachment_size,
            'reacted'         => $reacted,
            'is_mine'         => $viewerId !== null && $viewerId === $post->user_id,
            'created_at'      => $post->created_at?->toIso8601String(),
            'author'          => [
                'id'           => $post->author?->id,
                'name'         => $post->author?->name,
                'rcic_number'  => $post->author?->rcic_number,
                'company_name' => $post->author?->company_name,
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function formatReply(RcicCommunityReply $reply, ?int $viewerId = null): array
    {
        return [
            'id'         => $reply->id,
            'post_id'    => $reply->post_id,
            'body'       => $reply->body,
            'is_mine'    => $viewerId !== null && $viewerId === $reply->user_id,
            'created_at' => $reply->created_at?->toIso8601String(),
            'author'     => [
                'id'           => $reply->author?->id,
                'name'         => $reply->author?->name,
                'rcic_number'  => $reply->author?->rcic_number,
                'company_name' => $reply->author?->company_name,
            ],
        ];
    }
}
