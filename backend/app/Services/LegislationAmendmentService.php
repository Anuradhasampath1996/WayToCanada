<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\LegislationAmendmentAlert;
use App\Models\LegislationDocument;
use App\Models\User;
use App\Services\Notifications\NotificationService;
use App\Support\NotificationUrlBuilder;

class LegislationAmendmentService
{
    public function __construct(
        private NotificationService $notifications,
    ) {}

    public function recordAmendment(
        LegislationDocument $document,
        ?string $previousHash,
        string $newHash,
    ): ?LegislationAmendmentAlert {
        $watch = config('legislation_sources.amendment_watch', []);
        $act   = (string) ($document->act_code ?? '');

        if ($act === '' || ! in_array($act, $watch, true)) {
            return null;
        }

        if ($previousHash !== null && $previousHash === $newHash) {
            return null;
        }

        $alert = LegislationAmendmentAlert::create([
            'document_id'   => $document->id,
            'act_code'      => $act,
            'language'      => $document->language,
            'format'        => $document->format,
            'previous_hash' => $previousHash,
            'new_hash'      => $newHash,
            'detected_at'   => now(),
        ]);

        $this->notifyAdmins($alert, $document);

        return $alert;
    }

    /** @return list<array<string, mixed>> */
    public function recentUnacknowledged(int $limit = 10): array
    {
        return LegislationAmendmentAlert::query()
            ->with('document:id,title,act_code,language,format')
            ->whereNull('acknowledged_at')
            ->orderByDesc('detected_at')
            ->limit($limit)
            ->get()
            ->map(fn (LegislationAmendmentAlert $a) => [
                'id'          => $a->id,
                'act_code'    => $a->act_code,
                'language'    => $a->language,
                'format'      => $a->format,
                'title'       => $a->document?->title,
                'detected_at' => $a->detected_at?->toIso8601String(),
            ])
            ->all();
    }

    public function acknowledge(LegislationAmendmentAlert $alert, int $userId): void
    {
        $alert->update([
            'acknowledged_at' => now(),
            'acknowledged_by' => $userId,
        ]);
    }

    private function notifyAdmins(LegislationAmendmentAlert $alert, LegislationDocument $document): void
    {
        $title = "Legislation updated: {$alert->act_code}";
        $body  = "{$document->title} ({$alert->language}/{$alert->format}) was changed on Justice Canada. Re-run Sync + Linkify to refresh cross-references.";
        $dedupe = "legislation_amendment:{$alert->act_code}:{$alert->language}:{$alert->format}:{$alert->new_hash}";

        User::role(['super-admin', 'admin'])
            ->select('id')
            ->chunkById(50, function ($admins) use ($title, $body, $dedupe, $alert) {
                foreach ($admins as $admin) {
                    $this->notifications->dispatch(
                        $admin,
                        NotificationType::SYSTEM_ALERT,
                        $title,
                        $body,
                        NotificationUrlBuilder::adminLegislationsHub(),
                        "{$dedupe}:admin:{$admin->id}",
                        $alert,
                    );
                }
            });
    }
}
