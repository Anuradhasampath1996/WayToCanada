<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\RcicCommunityPost;
use App\Models\RcicCommunityReply;
use App\Models\RcicCommunityReport;
use App\Services\Notifications\RcicCommunityNotificationTriggers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\File;

class AdminRcicCommunityController extends Controller
{
    public function __construct(
        private RcicCommunityNotificationTriggers $communityNotifications,
    ) {}

    public function posts(Request $request): JsonResponse
    {
        $query = RcicCommunityPost::query()
            ->with(['author:id,name,email,rcic_number'])
            ->latest();

        if ($request->query('hidden') === '1') {
            $query->where('is_hidden', true);
        } elseif ($request->query('hidden') !== 'all') {
            $query->where('is_hidden', false);
        }

        if ($search = trim((string) $request->query('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'ilike', "%{$search}%")
                    ->orWhere('body', 'ilike', "%{$search}%");
            });
        }

        $paginated = $query->paginate(min((int) $request->query('per_page', 20), 100));

        return response()->json($paginated);
    }

    public function store(Request $request): JsonResponse
    {
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
            'user_id'         => $request->user()->id,
            'title'           => $validated['title'],
            'body'            => $validated['body'],
            'attachment_path' => $attachment['path'] ?? null,
            'attachment_name' => $attachment['name'] ?? null,
            'attachment_mime' => $attachment['mime'] ?? null,
            'attachment_size' => $attachment['size'] ?? null,
        ]);

        $post->load('author:id,name,email,rcic_number');
        $this->communityNotifications->onNewPost($post);

        return response()->json([
            'message' => 'Post published to RCIC Community.',
            'data'    => $post,
        ], 201);
    }

    public function reports(Request $request): JsonResponse
    {
        $query = RcicCommunityReport::query()
            ->with(['reporter:id,name,email'])
            ->latest();

        if ($status = $request->query('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        } else {
            $query->where('status', 'pending');
        }

        $paginated = $query->paginate(min((int) $request->query('per_page', 20), 100));

        $paginated->getCollection()->transform(function (RcicCommunityReport $report) {
            $content = $this->resolveReportable($report);

            return [
                'id'              => $report->id,
                'type'            => $report->reportable_type,
                'target_id'       => $report->reportable_id,
                'reason'          => $report->reason,
                'status'          => $report->status,
                'admin_notes'     => $report->admin_notes,
                'created_at'      => $report->created_at?->toIso8601String(),
                'reviewed_at'     => $report->reviewed_at?->toIso8601String(),
                'reporter'        => [
                    'id'    => $report->reporter?->id,
                    'name'  => $report->reporter?->name,
                    'email' => $report->reporter?->email,
                ],
                'content_preview' => $content,
            ];
        });

        return response()->json($paginated);
    }

    public function hidePost(Request $request, RcicCommunityPost $post): JsonResponse
    {
        $validated = $request->validate([
            'hidden' => 'required|boolean',
        ]);

        $post->update([
            'is_hidden' => $validated['hidden'],
            'hidden_at' => $validated['hidden'] ? now() : null,
            'hidden_by' => $validated['hidden'] ? $request->user()->id : null,
        ]);

        return response()->json([
            'message' => $validated['hidden'] ? 'Post hidden from community.' : 'Post restored.',
        ]);
    }

    public function hideReply(Request $request, RcicCommunityReply $reply): JsonResponse
    {
        $validated = $request->validate([
            'hidden' => 'required|boolean',
        ]);

        $reply->update([
            'is_hidden' => $validated['hidden'],
            'hidden_at' => $validated['hidden'] ? now() : null,
            'hidden_by' => $validated['hidden'] ? $request->user()->id : null,
        ]);

        if ($validated['hidden']) {
            $reply->post?->decrement('replies_count');
        } else {
            $reply->post?->increment('replies_count');
        }

        return response()->json([
            'message' => $validated['hidden'] ? 'Reply hidden.' : 'Reply restored.',
        ]);
    }

    public function destroyPost(RcicCommunityPost $post): JsonResponse
    {
        if ($post->attachment_path && Storage::disk('local')->exists($post->attachment_path)) {
            Storage::disk('local')->delete($post->attachment_path);
        }

        $post->delete();

        return response()->json(['message' => 'Post permanently deleted.']);
    }

    public function destroyReply(RcicCommunityReply $reply): JsonResponse
    {
        $post = $reply->post;
        $reply->delete();
        $post?->decrement('replies_count');

        return response()->json(['message' => 'Reply permanently deleted.']);
    }

    public function updateReport(Request $request, RcicCommunityReport $report): JsonResponse
    {
        $validated = $request->validate([
            'status'      => 'required|string|in:pending,reviewed,dismissed',
            'admin_notes' => 'nullable|string|max:2000',
            'hide_content'=> 'nullable|boolean',
        ]);

        $report->update([
            'status'      => $validated['status'],
            'admin_notes' => $validated['admin_notes'] ?? $report->admin_notes,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        if ($validated['hide_content'] ?? false) {
            if ($report->reportable_type === RcicCommunityReport::TYPE_POST) {
                $post = RcicCommunityPost::find($report->reportable_id);
                $post?->update(['is_hidden' => true, 'hidden_at' => now(), 'hidden_by' => $request->user()->id]);
            } elseif ($report->reportable_type === RcicCommunityReport::TYPE_REPLY) {
                $reply = RcicCommunityReply::find($report->reportable_id);
                if ($reply && ! $reply->is_hidden) {
                    $reply->update(['is_hidden' => true, 'hidden_at' => now(), 'hidden_by' => $request->user()->id]);
                    $reply->post?->decrement('replies_count');
                }
            }
        }

        return response()->json(['message' => 'Report updated.']);
    }

    /** @return array<string, mixed>|null */
    private function resolveReportable(RcicCommunityReport $report): ?array
    {
        if ($report->reportable_type === RcicCommunityReport::TYPE_POST) {
            $post = RcicCommunityPost::with('author:id,name')->find($report->reportable_id);
            if (! $post) {
                return null;
            }

            return [
                'title'  => $post->title,
                'body'   => \Illuminate\Support\Str::limit($post->body, 200),
                'author' => $post->author?->name,
                'hidden' => $post->is_hidden,
            ];
        }

        $reply = RcicCommunityReply::with('author:id,name', 'post:id,title')->find($report->reportable_id);
        if (! $reply) {
            return null;
        }

        return [
            'post_title' => $reply->post?->title,
            'body'       => \Illuminate\Support\Str::limit($reply->body, 200),
            'author'     => $reply->author?->name,
            'hidden'     => $reply->is_hidden,
        ];
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
}
