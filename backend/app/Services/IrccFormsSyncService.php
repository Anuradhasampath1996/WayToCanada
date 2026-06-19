<?php

namespace App\Services;

use App\Models\IrccCategory;
use App\Models\IrccCategoryDocument;
use App\Models\IrccFormCatalog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class IrccFormsSyncService
{
    public const INDEX_URL = 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides.html';

    /** @return array{created:int,updated:int,total:int,pdf_resolved:int,errors:array<int,string>} */
    public function syncCatalog(int $pdfResolveLimit = 40): array
    {
        $stats = ['created' => 0, 'updated' => 0, 'total' => 0, 'pdf_resolved' => 0, 'errors' => []];

        try {
            $response = Http::timeout(60)
                ->withHeaders(['User-Agent' => 'RCICMASTER/1.0 (+https://www.rcicmaster.com)'])
                ->get(self::INDEX_URL);

            if ($response->failed()) {
                $stats['errors'][] = 'Failed to fetch IRCC index page (HTTP ' . $response->status() . ').';
                return $stats;
            }

            $entries = $this->parseIndexTable($response->body());
            $stats['total'] = count($entries);

            $pdfBudget = $pdfResolveLimit;

            foreach ($entries as $entry) {
                $existing = IrccFormCatalog::where('normalized_code', $entry['normalized_code'])->first();

                $needsPdf = ! $existing
                    || $existing->date_modified !== $entry['date_modified']
                    || empty($existing->pdf_url);

                $catalog = IrccFormCatalog::updateOrCreate(
                    ['normalized_code' => $entry['normalized_code']],
                    [
                        'form_code'       => $entry['form_code'],
                        'title'           => $entry['title'],
                        'page_url'        => $entry['page_url'],
                        'page_slug'       => $entry['page_slug'],
                        'date_modified'   => $entry['date_modified'],
                        'last_fetched_at' => now(),
                    ]
                );

                if ($catalog->wasRecentlyCreated) {
                    $stats['created']++;
                } else {
                    $stats['updated']++;
                }

                if ($needsPdf && $pdfBudget > 0) {
                    try {
                        $pdf = $this->resolvePdfFromFormPage($entry['page_url']);
                        if ($pdf) {
                            $catalog->update([
                                'pdf_url'       => $pdf['url'],
                                'pdf_filename'  => $pdf['filename'],
                                'last_fetched_at' => now(),
                            ]);
                            $stats['pdf_resolved']++;
                            $pdfBudget--;
                        }
                    } catch (\Throwable $e) {
                        $stats['errors'][] = $entry['form_code'] . ': ' . $e->getMessage();
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::error('[IrccSync] Catalog sync failed', ['error' => $e->getMessage()]);
            $stats['errors'][] = $e->getMessage();
        }

        return $stats;
    }

    /** @return array{packages:int,downloaded:int,updated:int,skipped:int,errors:array<int,string>} */
    public function syncAllPackages(): array
    {
        $stats = ['packages' => 0, 'downloaded' => 0, 'updated' => 0, 'skipped' => 0, 'errors' => []];

        $packages = IrccCategory::where('level', 3)->get();
        $stats['packages'] = $packages->count();

        foreach ($packages as $package) {
            $result = $this->syncPackage($package);
            $stats['downloaded'] += $result['downloaded'];
            $stats['updated']    += $result['updated'];
            $stats['skipped']    += $result['skipped'];
            $stats['errors']     = array_merge($stats['errors'], $result['errors']);
        }

        return $stats;
    }

    /** @return array{downloaded:int,updated:int,skipped:int,errors:array<int,string>} */
    public function syncPackage(IrccCategory $package): array
    {
        $stats = ['downloaded' => 0, 'updated' => 0, 'skipped' => 0, 'errors' => []];

        if ($package->level !== 3 || empty($package->result)) {
            return $stats;
        }

        $references = $this->collectReferences($package->result);

        foreach ($references as $ref) {
            $catalog = $this->findCatalogEntry($ref);
            if (! $catalog) {
                $stats['errors'][] = "{$package->label}: no catalog match for '{$ref}'";
                continue;
            }

            if (empty($catalog->pdf_url)) {
                try {
                    $pdf = $this->resolvePdfFromFormPage($catalog->page_url);
                    if ($pdf) {
                        $catalog->update(['pdf_url' => $pdf['url'], 'pdf_filename' => $pdf['filename']]);
                    }
                } catch (\Throwable $e) {
                    $stats['errors'][] = "{$ref}: {$e->getMessage()}";
                    continue;
                }
            }

            if (empty($catalog->pdf_url)) {
                $stats['errors'][] = "{$ref}: PDF URL not found on IRCC page";
                continue;
            }

            $existing = IrccCategoryDocument::where('ircc_category_id', $package->id)
                ->where('source_form_code', $catalog->form_code)
                ->first();

            if ($existing
                && $existing->source_date_modified === $catalog->date_modified
                && Storage::disk('public')->exists($existing->file_path)
            ) {
                $stats['skipped']++;
                continue;
            }

            try {
                $saved = $this->downloadToPackage($package, $catalog, $existing);
                if ($existing) {
                    $stats['updated']++;
                } else {
                    $stats['downloaded']++;
                }
            } catch (\Throwable $e) {
                $stats['errors'][] = "{$catalog->form_code}: {$e->getMessage()}";
            }
        }

        return $stats;
    }

    /** @return list<array{form_code:string,title:string,page_url:string,page_slug:string,date_modified:?string,normalized_code:string}> */
    private function parseIndexTable(string $html): array
    {
        $entries = [];

        libxml_use_internal_errors(true);
        $dom = new \DOMDocument();
        @$dom->loadHTML($html);
        $xpath = new \DOMXPath($dom);

        foreach ($xpath->query('//table//tr') as $row) {
            $cells = $row->getElementsByTagName('td');
            if ($cells->length < 3) {
                continue;
            }

            $formCode = trim($cells->item(0)?->textContent ?? '');
            if ($formCode === '' || ! preg_match('/^(IMM|CIT|IRM|EM|e)/i', $formCode)) {
                continue;
            }

            $linkNode = $cells->item(1)?->getElementsByTagName('a')->item(0);
            $href     = $linkNode?->getAttribute('href') ?? '';
            $title    = trim($linkNode?->textContent ?? $formCode);
            $modified = trim($cells->item(2)?->textContent ?? '');

            if ($href === '') {
                continue;
            }

            $pageUrl  = Str::startsWith($href, 'http') ? $href : 'https://www.canada.ca' . $href;
            $slug     = basename(parse_url($pageUrl, PHP_URL_PATH) ?? '', '.html');

            $entries[] = [
                'form_code'       => $formCode,
                'normalized_code' => self::normalizeReference($formCode),
                'title'           => $title,
                'page_url'        => $pageUrl,
                'page_slug'       => $slug,
                'date_modified'   => $modified !== '' ? $modified : null,
            ];
        }

        libxml_clear_errors();

        return $entries;
    }

    /** @return array{url:string,filename:string}|null */
    private function resolvePdfFromFormPage(string $pageUrl): ?array
    {
        $response = Http::timeout(45)
            ->withHeaders(['User-Agent' => 'RCICMASTER/1.0 (+https://www.rcicmaster.com)'])
            ->get($pageUrl);

        if ($response->failed()) {
            return null;
        }

        $html = $response->body();

        if (preg_match_all('/href="(\/content\/dam\/ircc[^"]+\.pdf)"/i', $html, $matches)) {
            $path = html_entity_decode($matches[1][0]);
            return [
                'url'      => 'https://www.canada.ca' . $path,
                'filename' => basename($path),
            ];
        }

        if (preg_match_all('/href="(https:\/\/www\.canada\.ca\/content\/dam\/ircc[^"]+\.pdf)"/i', $html, $matches)) {
            return [
                'url'      => html_entity_decode($matches[1][0]),
                'filename' => basename(parse_url($matches[1][0], PHP_URL_PATH) ?? 'form.pdf'),
            ];
        }

        return null;
    }

    private function downloadToPackage(IrccCategory $package, IrccFormCatalog $catalog, ?IrccCategoryDocument $existing): IrccCategoryDocument
    {
        $response = Http::timeout(90)
            ->withHeaders(['User-Agent' => 'RCICMASTER/1.0 (+https://www.rcicmaster.com)'])
            ->get($catalog->pdf_url);

        if ($response->failed()) {
            throw new \RuntimeException('PDF download failed (HTTP ' . $response->status() . ').');
        }

        $docType = $this->inferDocType($catalog);
        $ext     = pathinfo($catalog->pdf_filename ?? 'form.pdf', PATHINFO_EXTENSION) ?: 'pdf';
        $filename = 'ircc-' . $package->id . '-' . $catalog->normalized_code . '-' . time() . '.' . $ext;
        $path     = 'application-packages/' . $package->id . '/' . $filename;

        if ($existing && Storage::disk('public')->exists($existing->file_path)) {
            Storage::disk('public')->delete($existing->file_path);
        }

        Storage::disk('public')->put($path, $response->body());

        $payload = [
            'label'                 => $catalog->title,
            'doc_type'              => $docType,
            'source_form_code'      => $catalog->form_code,
            'source_url'            => $catalog->pdf_url,
            'source_date_modified'  => $catalog->date_modified,
            'last_synced_at'        => now(),
            'auto_synced'           => true,
            'file_path'             => $path,
            'original_filename'     => $catalog->pdf_filename ?? basename($path),
            'mime_type'             => 'application/pdf',
            'file_size'             => strlen($response->body()),
            'is_active'             => true,
        ];

        if ($existing) {
            $existing->update($payload);
            return $existing->fresh();
        }

        return IrccCategoryDocument::create(array_merge($payload, [
            'ircc_category_id' => $package->id,
            'sort_order'       => ($package->documents()->max('sort_order') ?? 0) + 1,
        ]));
    }

    private function inferDocType(IrccFormCatalog $catalog): string
    {
        $hay = strtolower($catalog->title . ' ' . $catalog->form_code);

        if (str_contains($hay, 'checklist')) {
            return 'checklist';
        }
        if (str_contains($hay, 'guide') || str_contains($hay, 'instruction')) {
            return 'guide';
        }

        return 'form';
    }

    /** @return list<string> */
    private function collectReferences(array $result): array
    {
        $refs = [];

        if (! empty($result['guide']) && ! in_array(strtolower($result['guide']), ['none', 'n/a', 'dynamic e-apr'], true)) {
            $refs[] = $result['guide'];
        }
        if (! empty($result['checklist']) && ! in_array(strtolower($result['checklist']), ['none', 'n/a', 'dynamic e-apr'], true)) {
            $refs[] = $result['checklist'];
        }
        foreach ($result['forms'] ?? [] as $form) {
            if ($form && ! in_array(strtolower($form), ['none', 'online form', 'online web forms'], true)) {
                $refs[] = $form;
            }
        }

        return array_values(array_unique($refs));
    }

    private function findCatalogEntry(string $reference): ?IrccFormCatalog
    {
        $normalized = self::normalizeReference($reference);

        $exact = IrccFormCatalog::where('normalized_code', $normalized)->first();
        if ($exact) {
            return $exact;
        }

        // Match "IMM 5257" against catalog form_code
        $byCode = IrccFormCatalog::where('form_code', $reference)->first();
        if ($byCode) {
            return $byCode;
        }

        // Extract numeric part for guide-style refs e.g. Guide 5256
        if (preg_match('/(\d{3,5})/', $reference, $m)) {
            return IrccFormCatalog::where(function ($q) use ($m) {
                $q->where('normalized_code', 'like', '%' . $m[1] . '%')
                    ->orWhere('form_code', 'like', '%' . $m[1] . '%');
            })->first();
        }

        return null;
    }

    public static function normalizeReference(string $reference): string
    {
        $ref = trim($reference);

        if (preg_match('/guide\s*(\d+)/i', $ref, $m)) {
            return 'guide' . $m[1];
        }

        return strtolower(preg_replace('/\s+/', '', $ref));
    }
}
