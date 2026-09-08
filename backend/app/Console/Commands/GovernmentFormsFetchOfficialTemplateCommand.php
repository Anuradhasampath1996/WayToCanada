<?php

namespace App\Console\Commands;

use App\Services\IrccFormsSyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class GovernmentFormsFetchOfficialTemplateCommand extends Command
{
    protected $signature = 'government-forms:fetch-official
        {form=IMM5476 : Form code e.g. IMM5476 or IMM 5476}
        {--page-url= : Override official Canada.ca form page URL}';

    protected $description = 'Download the current official IRCC PDF template from Canada.ca (PoC/dev only).';

    private const DEFAULT_PAGE_URLS = [
        'imm5476' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5476.html',
        'imm1294' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm1294.html',
        'imm1295' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm1295.html',
        'imm5707' => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5707.html',
    ];

    public function handle(IrccFormsSyncService $sync): int
    {
        $normalized = IrccFormsSyncService::normalizeReference($this->argument('form'));
        $pageUrl = $this->option('page-url')
            ?: (self::DEFAULT_PAGE_URLS[$normalized] ?? null);

        if (! $pageUrl) {
            $this->error('No official page URL configured for this form. Pass --page-url=');

            return self::FAILURE;
        }

        $this->info("Fetching official page: {$pageUrl}");

        $response = Http::timeout(60)
            ->withHeaders(['User-Agent' => 'RCICMASTER/1.0 (+https://www.rcicmaster.com)'])
            ->get($pageUrl);

        if ($response->failed()) {
            $this->error('Failed to fetch form page (HTTP '.$response->status().').');

            return self::FAILURE;
        }

        $html = $response->body();
        $versionLabel = $this->extractVersionLabel($html);
        $dateModified = $this->extractDateModified($html);
        $pdfMeta = $this->resolvePdfLink($html);

        if (! $pdfMeta) {
            $this->error('Could not locate official PDF link on the form page.');

            return self::FAILURE;
        }

        $this->line('Official version label: '.($versionLabel ?: 'unknown'));
        $this->line('Page last updated: '.($dateModified ?: 'unknown'));
        $this->line('Official PDF URL: '.$pdfMeta['url']);

        $pdfResponse = Http::timeout(120)
            ->withHeaders(['User-Agent' => 'RCICMASTER/1.0 (+https://www.rcicmaster.com)'])
            ->get($pdfMeta['url']);

        if ($pdfResponse->failed()) {
            $this->error('PDF download failed (HTTP '.$pdfResponse->status().').');

            return self::FAILURE;
        }

        $bytes = $pdfResponse->body();
        $sha256 = hash('sha256', $bytes);
        $filename = $normalized.'-official-'.substr($sha256, 0, 12).'.pdf';
        $storagePath = 'government-forms-poc/templates/official/'.$filename;

        Storage::disk('local')->put($storagePath, $bytes);

        $manifest = [
            'form_code' => strtoupper($normalized),
            'normalized_code' => $normalized,
            'official_page_url' => $pageUrl,
            'official_pdf_url' => $pdfMeta['url'],
            'official_pdf_filename' => $pdfMeta['filename'],
            'version_label' => $versionLabel,
            'page_last_updated' => $dateModified,
            'downloaded_at' => now()->toIso8601String(),
            'template_sha256' => $sha256,
            'storage_path' => $storagePath,
            'byte_size' => strlen($bytes),
        ];

        $manifestPath = 'government-forms-poc/templates/official/'.$normalized.'-manifest.json';
        Storage::disk('local')->put($manifestPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        $this->newLine();
        $this->info('Official template stored.');
        $this->line('Storage path: storage/app/private/'.$storagePath);
        $this->line('SHA-256: '.$sha256);
        $this->line('Manifest: storage/app/private/'.$manifestPath);

        $this->compareWithExistingPublicCopies($normalized, $sha256);

        return self::SUCCESS;
    }

    private function extractVersionLabel(string $html): ?string
    {
        if (preg_match('/new version of this form is available\s*\(([^)]+)\)/i', $html, $m)) {
            return trim($m[1]);
        }

        return null;
    }

    private function extractDateModified(string $html): ?string
    {
        if (preg_match('/Last updated:\s*([^<]+)</i', $html, $m)) {
            return trim(html_entity_decode($m[1]));
        }

        return null;
    }

    /** @return array{url: string, filename: string}|null */
    private function resolvePdfLink(string $html): ?array
    {
        if (preg_match_all('/href="(\/content\/dam\/ircc[^"]+\.pdf)"/i', $html, $matches)) {
            $path = html_entity_decode($matches[1][0]);

            return [
                'url' => 'https://www.canada.ca'.$path,
                'filename' => basename($path),
            ];
        }

        if (preg_match_all('/href="(https:\/\/www\.canada\.ca\/content\/dam\/ircc[^"]+\.pdf)"/i', $html, $matches)) {
            return [
                'url' => html_entity_decode($matches[1][0]),
                'filename' => basename(parse_url($matches[1][0], PHP_URL_PATH) ?? 'form.pdf'),
            ];
        }

        return null;
    }

    private function compareWithExistingPublicCopies(string $normalized, string $officialSha): void
    {
        $publicRoot = storage_path('app/public/application-packages');
        if (! is_dir($publicRoot)) {
            $this->warn('No public application-packages directory found to compare.');

            return;
        }

        $matches = [];
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($publicRoot));
        foreach ($iterator as $file) {
            if (! $file->isFile()) {
                continue;
            }
            $name = $file->getFilename();
            if (! preg_match('/'.preg_quote($normalized, '/').'/i', $name) && ! preg_match('/5476/i', $name)) {
                continue;
            }
            if (strtolower($file->getExtension()) !== 'pdf') {
                continue;
            }
            $hash = hash_file('sha256', $file->getPathname());
            $matches[] = [
                'path' => $file->getPathname(),
                'sha256' => $hash,
                'matches_official' => hash_equals($officialSha, $hash),
            ];
        }

        if ($matches === []) {
            $this->warn('No existing stored IMM 5476 PDF copies found under application-packages.');

            return;
        }

        $this->newLine();
        $this->info('Comparison against existing stored templates:');
        foreach ($matches as $match) {
            $status = $match['matches_official'] ? 'MATCH' : 'MISMATCH';
            $this->line("[{$status}] {$match['path']}");
            $this->line('  SHA-256: '.$match['sha256']);
        }
    }
}
