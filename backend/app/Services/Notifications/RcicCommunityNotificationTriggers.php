<?php

namespace App\Services\Notifications;

use App\Enums\NotificationType;
use App\Models\RcicCommunityPost;
use App\Models\RcicCommunityReaction;
use App\Models\RcicCommunityReply;
use App\Models\RcicCommunityReport;
use App\Models\User;
use App\Support\NotificationUrlBuilder;
use Illuminate\Support\Str;

class RcicCommunityNotificationTriggers
{
    public function __construct(
        private NotificationService $notifications,
    ) {}

    public function onNewPost(RcicCommunityPost $post): void
    {
        $post->loadMissing('author:id,name');
        $authorName = $post->author?->name ?? 'A consultant';
        $preview    = Str::limit($post->title, 80);

        User::role('rcic')
            ->where('id', '!=', $post->user_id)
            ->select('id')
            ->chunkById(100, function ($consultants) use ($post, $authorName, $preview) {
                foreach ($consultants as $consultant) {
                    $this->notifications->dispatch(
                        $consultant,
                        NotificationType::RCIC_COMMUNITY_NEW_POST,
                        'New post in RCIC Community',
                        "{$authorName}: {$preview}",
                        NotificationUrlBuilder::consultantRcicCommunity($post->id),
                        "rcic_post:{$post->id}:new",
                        $post,
                    );
                }
            });
    }

    public function onReply(RcicCommunityReply $reply): void
    {
        $reply->loadMissing('author:id,name', 'post.user_id', 'post:id,title,user_id');
        $post = $reply->post;
        if (! $post || $post->user_id === $reply->user_id) {
            return;
        }

        $author = User::find($post->user_id);
        if (! $author) {
            return;
        }

        $replierName = $reply->author?->name ?? 'A consultant';
        $preview     = Str::limit($reply->body, 120);

        $this->notifications->dispatch(
            $author,
            NotificationType::RCIC_COMMUNITY_REPLY,
            'New reply on your community post',
            "{$replierName} replied on \"{$post->title}\": {$preview}",
            NotificationUrlBuilder::consultantRcicCommunity($post->id),
            "rcic_reply:{$reply->id}:to:{$post->user_id}",
            $reply,
        );
    }

    public function onReaction(RcicCommunityReaction $reaction, bool $added): void
    {
        if (! $added) {
            return;
        }

        $reaction->loadMissing('user:id,name', 'post:id,title,user_id');
        $post = $reaction->post;
        if (! $post || $post->user_id === $reaction->user_id) {
            return;
        }

        $author = User::find($post->user_id);
        if (! $author) {
            return;
        }

        $reactorName = $reaction->user?->name ?? 'A consultant';
        $label       = $reaction->reaction === 'helpful' ? 'found your post helpful' : 'reacted to your post';

        $this->notifications->dispatch(
            $author,
            NotificationType::RCIC_COMMUNITY_REACTION,
            'Reaction on your community post',
            "{$reactorName} {$label}: \"{$post->title}\"",
            NotificationUrlBuilder::consultantRcicCommunity($post->id),
            "rcic_react:{$reaction->id}:to:{$post->user_id}",
            $reaction,
        );
    }

    public function onReport(RcicCommunityReport $report): void
    {
        $report->loadMissing('reporter:id,name');
        $reporterName = $report->reporter?->name ?? 'A consultant';
        $preview      = Str::limit($report->reason, 120);
        $label        = $report->reportable_type === RcicCommunityReport::TYPE_REPLY ? 'reply' : 'post';

        User::role(['super-admin', 'admin'])
            ->select('id')
            ->chunkById(50, function ($admins) use ($report, $reporterName, $preview, $label) {
                foreach ($admins as $admin) {
                    $this->notifications->dispatch(
                        $admin,
                        NotificationType::RCIC_COMMUNITY_REPORT,
                        'RCIC Community report submitted',
                        "{$reporterName} reported a {$label}: {$preview}",
                        NotificationUrlBuilder::adminRcicCommunity('reports'),
                        "rcic_report:{$report->id}:admin:{$admin->id}",
                        $report,
                    );
                }
            });
    }
}
