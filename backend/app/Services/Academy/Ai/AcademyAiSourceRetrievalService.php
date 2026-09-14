<?php

namespace App\Services\Academy\Ai;

use App\Models\Academy\AcademyAiGenerationJob;
use App\Models\Academy\AcademyAiSourcePack;
use App\Models\Academy\AcademyAiSourcePackItem;
use App\Models\Academy\AcademyAiSourceSnapshot;
use App\Models\Academy\AcademyLegalSource;
use App\Services\Academy\Ai\Dto\ResearchNotes;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class AcademyAiSourceRetrievalService
{
    public function snapshotPack(AcademyAiGenerationJob $job): void
    {
        $pack = $job->sourcePack;
        if (! $pack) {
            return;
        }

        foreach ($pack->items as $item) {
            if ($item->item_type === 'manus_candidate') {
                continue;
            }
            $this->snapshotItem($job, $item);
        }
    }

    public function ingestResearchCandidates(AcademyAiGenerationJob $job, ResearchNotes $notes): void
    {
        $pack = $job->sourcePack ?: AcademyAiSourcePack::query()->create([
            'generation_job_id' => $job->id,
            'status' => 'research',
        ]);

        foreach ($notes->candidateSources as $candidate) {
            $url = (string) ($candidate['url'] ?? '');
            $item = AcademyAiSourcePackItem::query()->create([
                'source_pack_id' => $pack->id,
                'item_type' => 'manus_candidate',
                'url' => $url ?: null,
                'title' => $candidate['title'] ?? null,
                'organization' => $candidate['organization'] ?? null,
                'meta_json' => $candidate,
            ]);

            if ($url === '' || ! $this->hostAllowed($url, false)) {
                AcademyAiSourceSnapshot::query()->create([
                    'generation_job_id' => $job->id,
                    'pack_item_id' => $item->id,
                    'title' => $candidate['title'] ?? 'Rejected candidate',
                    'url' => $url ?: null,
                    'organization' => $candidate['organization'] ?? $notes->provider,
                    'retrieved_at' => now(),
                    'content_hash' => hash('sha256', 'rejected:'.$url),
                    'excerpt' => 'Discovery only — host not allow-listed. Not used as legal authority.',
                    'retrieval_method' => 'research_candidate_rejected',
                    'allowlisted' => false,
                    'authoritative' => false,
                ]);

                continue;
            }

            $this->snapshotUrl($job, $item, $url, false);
        }
    }

    public function snapshotItem(AcademyAiGenerationJob $job, AcademyAiSourcePackItem $item): ?AcademyAiSourceSnapshot
    {
        $existing = AcademyAiSourceSnapshot::query()->where('pack_item_id', $item->id)->first();
        if ($existing) {
            return $existing;
        }

        return match ($item->item_type) {
            'academy_source' => $this->snapshotAcademySource($job, $item),
            'url' => $this->snapshotUrl($job, $item, (string) $item->url, (bool) $item->admin_trusted_host),
            'upload' => $this->snapshotUpload($job, $item),
            default => null,
        };
    }

    public function hostAllowed(string $url, bool $adminTrusted): bool
    {
        if ($adminTrusted) {
            return true;
        }
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $allowed = array_map('strtolower', config('academy_ai.retrieval_allow_hosts', []));

        return $host !== '' && in_array($host, $allowed, true);
    }

    private function snapshotAcademySource(AcademyAiGenerationJob $job, AcademyAiSourcePackItem $item): AcademyAiSourceSnapshot
    {
        $source = AcademyLegalSource::query()->findOrFail($item->legal_source_id);
        $text = trim(implode("\n", array_filter([
            $source->title,
            $source->citation_label,
            $source->summary,
            $source->source_url,
        ])));
        $text = $this->cap($text);

        return $this->storeSnapshot($job, $item, [
            'legal_source_id' => $source->id,
            'title' => $source->title,
            'url' => $source->source_url,
            'organization' => $source->source_organization,
            'version_label' => $source->version_label,
            'effective_date' => $source->effective_date,
            'last_verified_at' => $source->last_verified_at,
            'text' => $text,
            'method' => 'academy_source',
            'authoritative' => in_array($source->status, ['published', 'approved'], true),
            'allowlisted' => true,
        ]);
    }

    private function snapshotUrl(AcademyAiGenerationJob $job, AcademyAiSourcePackItem $item, string $url, bool $trusted): ?AcademyAiSourceSnapshot
    {
        if ($url === '' || ! $this->hostAllowed($url, $trusted)) {
            return AcademyAiSourceSnapshot::query()->create([
                'generation_job_id' => $job->id,
                'pack_item_id' => $item->id,
                'title' => $item->title,
                'url' => $url,
                'retrieved_at' => now(),
                'content_hash' => hash('sha256', 'blocked:'.$url),
                'excerpt' => 'URL rejected by source allow-list.',
                'retrieval_method' => 'url_rejected',
                'allowlisted' => false,
                'authoritative' => false,
            ]);
        }

        try {
            $response = Http::timeout(20)->get($url);
        } catch (\Throwable) {
            $text = $this->cap(($item->title ?: $url).' (fetch failed)');

            return $this->storeSnapshot($job, $item, [
                'title' => $item->title ?: $url,
                'url' => $url,
                'organization' => $item->organization,
                'text' => $text,
                'method' => 'url_fetch',
                'authoritative' => false,
                'allowlisted' => true,
            ]);
        }

        $ok = $response->successful();
        $text = $this->cap($ok ? trim(strip_tags((string) $response->body())) : (($item->title ?: $url).' (fetch failed)'));

        return $this->storeSnapshot($job, $item, [
            'title' => $item->title ?: $url,
            'url' => $url,
            'organization' => $item->organization,
            'text' => $text,
            'method' => 'url_fetch',
            'authoritative' => $ok,
            'allowlisted' => true,
        ]);
    }

    private function snapshotUpload(AcademyAiGenerationJob $job, AcademyAiSourcePackItem $item): AcademyAiSourceSnapshot
    {
        $disk = $item->storage_disk ?: config('academy.media_disk');
        $path = (string) $item->storage_path;
        $raw = $path !== '' && Storage::disk($disk)->exists($path)
            ? (string) Storage::disk($disk)->get($path)
            : '';
        $text = $this->cap($raw);

        return $this->storeSnapshot($job, $item, [
            'title' => $item->title ?: basename($path),
            'text' => $text,
            'method' => 'upload',
            'authoritative' => false,
            'allowlisted' => true,
            'disk' => $disk,
            'path' => $path,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function storeSnapshot(AcademyAiGenerationJob $job, AcademyAiSourcePackItem $item, array $data): AcademyAiSourceSnapshot
    {
        $text = (string) ($data['text'] ?? '');
        $hash = hash('sha256', $text);
        $disk = $data['disk'] ?? config('academy.media_disk');
        $path = $data['path'] ?? 'ai-snapshots/'.$job->id.'/'.$hash.'.txt';
        if (empty($data['path'])) {
            Storage::disk($disk)->put($path, $text);
        }

        return AcademyAiSourceSnapshot::query()->create([
            'generation_job_id' => $job->id,
            'legal_source_id' => $data['legal_source_id'] ?? $item->legal_source_id,
            'pack_item_id' => $item->id,
            'title' => $data['title'] ?? $item->title,
            'url' => $data['url'] ?? $item->url,
            'organization' => $data['organization'] ?? $item->organization,
            'version_label' => $data['version_label'] ?? null,
            'effective_date' => $data['effective_date'] ?? null,
            'last_verified_at' => $data['last_verified_at'] ?? null,
            'retrieved_at' => now(),
            'content_hash' => $hash,
            'storage_disk' => $disk,
            'storage_path' => $path,
            'excerpt' => mb_substr($text, 0, 1500),
            'retrieval_method' => $data['method'],
            'allowlisted' => (bool) ($data['allowlisted'] ?? true),
            'authoritative' => (bool) ($data['authoritative'] ?? false),
        ]);
    }

    private function cap(string $text): string
    {
        $max = (int) app(AcademyAiSettingsService::class)->current()['max_source_chars'];

        return mb_substr($text, 0, max(200, $max));
    }
}
