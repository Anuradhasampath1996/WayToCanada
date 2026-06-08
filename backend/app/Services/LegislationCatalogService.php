<?php

namespace App\Services;

use App\Models\LegislationCatalogEntry;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class LegislationCatalogService
{
    private const INDEX_LETTERS = ['num', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'y'];

    /** @return array{discovered: int, total: int, sample: array<int, array<string, mixed>>} */
    public function discoverActs(): array
    {
        return $this->discoverFromIndex('/eng/acts/', 'act');
    }

    /** @return array{discovered: int, total: int, sample: array<int, array<string, mixed>>} */
    public function discoverRegulations(): array
    {
        return $this->discoverFromIndex('/eng/regulations/', 'regulation');
    }

    /** @return array{discovered: int, total: int, sample: array<int, array<string, mixed>>} */
    private function discoverFromIndex(string $indexPath, string $category): array
    {
        $base  = rtrim(config('legislation_sources.base_url'), '/').$indexPath;
        $found = [];

        foreach (self::INDEX_LETTERS as $letter) {
            $file = $letter === 'num' ? 'num.html' : "{$letter}.html";
            $response = Http::timeout(60)->get($base.$file);
            if (! $response->successful()) {
                continue;
            }

            preg_match_all(
                '/href="([A-Za-z0-9\.\-]+)\/index\.html">\s*([^<]+)/',
                $response->body(),
                $matches,
                PREG_SET_ORDER
            );

            foreach ($matches as $m) {
                $code = $m[1];
                if (strlen($code) < 2) {
                    continue;
                }
                $title = trim(html_entity_decode(strip_tags($m[2])));
                $found[$code] = Str::limit($title !== '' ? $title : $code, 500, '…');
            }
        }

        $now = now();
        foreach ($found as $code => $title) {
            LegislationCatalogEntry::updateOrCreate(
                ['act_code' => $code],
                [
                    'title'         => $title,
                    'category'      => $category,
                    'fr_act_code'   => $category === 'regulation' ? $this->frenchRegulationCode($code) : $code,
                    'is_active'     => true,
                    'discovered_at' => $now,
                ]
            );
        }

        return [
            'discovered' => count($found),
            'total'      => LegislationCatalogEntry::where('category', $category)->count(),
            'sample'     => LegislationCatalogEntry::where('category', $category)
                ->orderBy('title')->limit(20)->get(['act_code', 'title', 'category', 'last_synced_at'])->toArray(),
        ];
    }

    public function frenchRegulationCode(string $code): string
    {
        if (str_starts_with(strtoupper($code), 'SOR-')) {
            return 'DORS-'.substr($code, 4);
        }

        return $code;
    }

    /** @return array<string, mixed> */
    public function buildSourceConfig(LegislationCatalogEntry $entry): array
    {
        return $entry->category === 'regulation'
            ? $this->buildRegulationSourceConfig($entry->act_code, $entry->title, $entry->fr_act_code)
            : $this->buildActSourceConfig($entry->act_code, $entry->title);
    }

    /** @return array<string, mixed> */
    public function buildActSourceConfig(string $actCode, string $title): array
    {
        $pdf = '/pdf/'.strtolower($actCode).'.pdf';

        return [
            'title'    => $title,
            'act_code' => $actCode,
            'category' => 'act',
            'formats'  => [
                'xml'  => ['en' => "/eng/XML/{$actCode}.xml", 'fr' => "/fra/XML/{$actCode}.xml"],
                'html' => ['en' => "/eng/acts/{$actCode}/page-1.html", 'fr' => "/fra/lois/{$actCode}/page-1.html"],
                'pdf'  => ['en' => $pdf, 'fr' => $pdf],
            ],
        ];
    }

    /** @return array<string, mixed> */
    public function buildRegulationSourceConfig(string $actCode, string $title, ?string $frCode = null): array
    {
        $frCode = $frCode ?? $this->frenchRegulationCode($actCode);
        $pdf    = '/pdf/'.strtolower($actCode).'.pdf';

        return [
            'title'           => $title,
            'act_code'        => $actCode,
            'category'        => 'regulation',
            'parent_act_code' => config('legislation_sources.regulation_parent_acts')[$actCode] ?? null,
            'formats'         => [
                'xml'  => ['en' => "/eng/XML/{$actCode}.xml", 'fr' => "/fra/XML/{$frCode}.xml"],
                'html' => ['en' => "/eng/regulations/{$actCode}/page-1.html", 'fr' => "/fra/reglements/{$frCode}/page-1.html"],
                'pdf'  => ['en' => $pdf, 'fr' => $pdf],
            ],
        ];
    }

    public function sourceSlugForEntry(LegislationCatalogEntry $entry): string
    {
        $prefix = $entry->category === 'regulation' ? 'reg' : 'act';

        return $prefix.'-'.Str::lower(str_replace('.', '-', $entry->act_code));
    }

    /** @return LengthAwarePaginator<int, LegislationCatalogEntry> */
    public function listCatalog(?string $search, ?string $category, int $perPage = 25): LengthAwarePaginator
    {
        $query = LegislationCatalogEntry::query()->where('is_active', true)->orderBy('title');

        if ($category) {
            $query->where('category', $category);
        }
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'ilike', "%{$search}%")
                    ->orWhere('act_code', 'ilike', "%{$search}%");
            });
        }

        return $query->paginate($perPage);
    }

    /** @return array<string, array> */
    public function catalogSourcesMap(?string $category = null): array
    {
        $map   = [];
        $query = LegislationCatalogEntry::where('is_active', true)->orderBy('act_code');
        if ($category) {
            $query->where('category', $category);
        }

        foreach ($query->cursor() as $entry) {
            $slug       = $this->sourceSlugForEntry($entry);
            $map[$slug] = $this->buildSourceConfig($entry);
        }

        return $map;
    }

    /** @return array{acts: int, regulations: int, synced: int, pending: int} */
    public function catalogStats(): array
    {
        $acts = LegislationCatalogEntry::where('category', 'act')->where('is_active', true)->count();
        $regs = LegislationCatalogEntry::where('category', 'regulation')->where('is_active', true)->count();
        $synced = LegislationCatalogEntry::where('is_active', true)->whereNotNull('last_synced_at')->count();

        return [
            'acts'        => $acts,
            'regulations' => $regs,
            'synced'      => $synced,
            'pending'     => ($acts + $regs) - $synced,
        ];
    }
}
