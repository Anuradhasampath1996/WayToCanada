<?php

namespace App\Services;

use App\Models\ConsultantLegislationBookmark;
use App\Models\User;

class ConsultantLegislationBookmarkService
{
    public function __construct(
        private LegislationHubLinkService $hubLinks,
    ) {}

    /** @return list<array<string, mixed>> */
    public function listForConsultant(User $consultant, ?int $clientProfileId = null): array
    {
        $query = ConsultantLegislationBookmark::query()
            ->where('consultant_id', $consultant->id)
            ->orderByDesc('updated_at');

        if ($clientProfileId !== null) {
            $query->where(function ($q) use ($clientProfileId) {
                $q->whereNull('client_profile_id')
                    ->orWhere('client_profile_id', $clientProfileId);
            });
        }

        return $query->get()->map(fn (ConsultantLegislationBookmark $b) => $this->serialize($b))->all();
    }

    /** @return array<string, mixed> */
    public function store(User $consultant, array $data): array
    {
        $bookmark = ConsultantLegislationBookmark::updateOrCreate(
            [
                'consultant_id'     => $consultant->id,
                'client_profile_id' => $data['client_profile_id'] ?? null,
                'act_code'          => $data['act_code'],
                'provision_key'     => $data['provision_key'],
                'language'          => $data['language'] ?? 'en',
            ],
            [
                'label' => $data['label'] ?? null,
                'note'  => $data['note'] ?? null,
            ],
        );

        return $this->serialize($bookmark);
    }

    public function delete(User $consultant, ConsultantLegislationBookmark $bookmark): void
    {
        if ($bookmark->consultant_id !== $consultant->id) {
            abort(404);
        }

        $bookmark->delete();
    }

    /** @return array<string, mixed> */
    private function serialize(ConsultantLegislationBookmark $bookmark): array
    {
        $link = $this->hubLinks->buildLink(
            $bookmark->act_code,
            $bookmark->provision_key,
            $bookmark->language,
            $bookmark->label,
        );

        return array_merge($link, [
            'id'                => $bookmark->id,
            'client_profile_id' => $bookmark->client_profile_id,
            'label'             => $bookmark->label,
            'note'              => $bookmark->note,
            'created_at'        => $bookmark->created_at?->toIso8601String(),
        ]);
    }
}
