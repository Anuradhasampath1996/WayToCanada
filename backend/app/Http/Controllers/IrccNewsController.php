<?php

namespace App\Http\Controllers;

use App\Models\IrccNews;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class IrccNewsController extends Controller
{
    /**
     * Ordered list of feed sources to try.
     */
    private const FEEDS = [
        // Canada.ca news search results — IRCC news releases (server-side rendered, reachable)
        [
            'url'  => 'https://www.canada.ca/en/news/advanced-news-search/news-results.html?typ=newsreleases&dprtmnt=departmentofcitizenshipandimmigration&start=2021-01-01&end=&sort=date_d',
            'type' => 'html-scrape',
        ],
        // Same for media advisories
        [
            'url'  => 'https://www.canada.ca/en/news/advanced-news-search/news-results.html?typ=mediaadvisories&dprtmnt=departmentofcitizenshipandimmigration&start=2021-01-01&end=&sort=date_d',
            'type' => 'html-scrape',
        ],
    ];

    private const TIMEOUT_SEC = 15;

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/ircc-news
     */
    public function index(): JsonResponse
    {
        $items = IrccNews::orderByDesc('published_at')->take(30)->get();

        if ($items->isEmpty()) {
            $items = $this->fetchAndPersist();
        }

        return response()->json([
            'data'  => $items,
            'total' => $items->count(),
        ]);
    }

    /**
     * POST /api/v1/admin/ircc-news/refresh
     */
    public function refresh(): JsonResponse
    {
        $items = $this->fetchAndPersist();

        return response()->json([
            'message' => 'IRCC news cache refreshed.',
            'total'   => $items->count(),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Try each feed source until one returns data, then upsert into DB.
     */
    public function fetchAndPersist(): \Illuminate\Support\Collection
    {
        foreach (self::FEEDS as $feed) {
            try {
                Log::info("[IrccNews] Trying {$feed['type']}: {$feed['url']}");

                $response = Http::timeout(self::TIMEOUT_SEC)
                    ->withHeaders(['Accept' => 'application/rss+xml, application/xml, text/html, application/json, */*'])
                    ->get($feed['url']);

                if (! $response->successful()) {
                    Log::warning("[IrccNews] HTTP {$response->status()} from {$feed['url']}");
                    continue;
                }

                $count = match ($feed['type']) {
                    'rss'        => $this->persistRss($response->body()),
                    'gc-json'    => $this->persistGcJson($response->json()),
                    'html-scrape'=> $this->persistHtmlScrape($response->body(), $feed['url']),
                    default      => 0,
                };

                Log::info("[IrccNews] Persisted {$count} items from {$feed['url']}");

                if ($count > 0) {
                    break; // success — stop trying further sources
                }

            } catch (\Throwable $e) {
                Log::error("[IrccNews] Error fetching {$feed['url']}: " . $e->getMessage());
            }
        }

        return IrccNews::orderByDesc('published_at')->take(30)->get();
    }

    // ─────────────────────────────────────────────────────────────────────────

    private function persistRss(string $body): int
    {
        $xml = @simplexml_load_string($body, 'SimpleXMLElement', LIBXML_NOCDATA);

        if ($xml === false || ! isset($xml->channel->item)) {
            Log::warning('[IrccNews] RSS XML parse failed. Body snippet: ' . mb_substr($body, 0, 300));
            return 0;
        }

        $count = 0;
        foreach ($xml->channel->item as $item) {
            if ($this->upsertItem(
                guid        : trim((string) ($item->guid ?? $item->link)),
                title       : trim((string) $item->title),
                link        : trim((string) $item->link),
                description : strip_tags(trim((string) $item->description)),
                category    : trim((string) $item->category),
                pubDate     : isset($item->pubDate) ? (string) $item->pubDate : null,
            )) {
                $count++;
            }
        }

        return $count;
    }

    private function persistGcJson(?array $json): int
    {
        $rows = $json['data'] ?? $json['results'] ?? $json['items'] ?? [];

        if (empty($rows)) {
            Log::warning('[IrccNews] GC JSON API returned empty data. Keys: ' . implode(',', array_keys($json ?? [])));
            return 0;
        }

        $count = 0;
        foreach ($rows as $row) {
            $title = $row['title'] ?? $row['headline'] ?? '';
            $link  = $row['link']  ?? $row['url']      ?? $row['canonicalUrl'] ?? '';
            $guid  = $row['id']    ?? $row['guid']      ?? $link;

            if (! $guid || ! $title) continue;

            if ($this->upsertItem(
                guid        : $guid,
                title       : $title,
                link        : $link,
                description : strip_tags($row['description'] ?? $row['excerpt'] ?? ''),
                category    : $row['category'] ?? $row['type'] ?? null,
                pubDate     : $row['publishedDate'] ?? $row['pubDate'] ?? $row['date'] ?? null,
            )) {
                $count++;
            }
        }

        return $count;
    }

    private function persistHtmlScrape(string $html, string $pageUrl): int
    {
        $dom = new \DOMDocument();
        @$dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
        $xpath = new \DOMXPath($dom);

        // Canada.ca news-results.html: each article link is an <a> inside an <h3>
        // The href contains "/20XX/" and "/immigration" in the path
        $anchors = $xpath->query(
            '//a[contains(@href,"/20") and (contains(@href,"immigration") or contains(@href,"citizenship") or contains(@href,"refugee"))]'
        );

        $count = 0;
        $seen  = [];

        foreach ($anchors as $anchor) {
            /** @var \DOMElement $anchor */
            $href  = $anchor->getAttribute('href');
            $title = trim(preg_replace('/\s+/', ' ', $anchor->textContent));

            if (! $title || strlen($title) < 10) continue;
            if (isset($seen[$href])) continue;
            $seen[$href] = true;

            // The href is already absolute (e.g. https://www.canada.ca/...)
            $link = $href;

            // Extract date from URL path: /2026/05/ → 2026-05-01
            $pubDate = null;
            if (preg_match('|/(\d{4})/(\d{2})/|', $href, $dm)) {
                $pubDate = "{$dm[1]}-{$dm[2]}-01";
            }

            // Try to find a <time> or date text near the anchor
            $parent = $anchor->parentNode; // usually <h3>
            $articleNode = $parent?->parentNode; // <li> or <article> or <div>
            if ($articleNode) {
                $times = $xpath->query('.//time', $articleNode);
                if ($times->length) {
                    $t = $times->item(0)->getAttribute('datetime') ?: $times->item(0)->textContent;
                    if ($t) $pubDate = $t;
                }
                if (! $pubDate) {
                    $text = $articleNode->textContent;
                    if (preg_match('/\b(\w+ \d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})\b/', $text, $dm)) {
                        $pubDate = $dm[1];
                    }
                }
            }

            // Determine category from URL type param context (pass base URL label as category)
            $category = str_contains($pageUrl, 'mediaadvisories') ? 'Media Advisory' : 'News Release';

            if ($this->upsertItem(
                guid        : $link,
                title       : $title,
                link        : $link,
                description : '',
                category    : $category,
                pubDate     : $pubDate,
            )) {
                $count++;
                if ($count >= 30) break;
            }
        }

        Log::info("[IrccNews] HTML scrape found {$count} items from {$pageUrl}");
        return $count;
    }

    private function upsertItem(
        string $guid,
        string $title,
        string $link,
        string $description,
        ?string $category,
        ?string $pubDate,
    ): bool {
        if (! $guid || ! $title) return false;

        // Hash long GUIDs to fit in VARCHAR(255)
        $safeGuid = strlen($guid) > 250 ? 'sha1:' . sha1($guid) : $guid;

        try {
            $publishedAt = $pubDate ? \Carbon\Carbon::parse($pubDate) : now();
        } catch (\Throwable) {
            $publishedAt = now();
        }

        IrccNews::updateOrCreate(
            ['guid' => $safeGuid],
            [
                'title'        => mb_substr($title, 0, 500),
                'link'         => $link,
                'description'  => $description ?: null,
                'category'     => $category ? mb_substr($category, 0, 200) : null,
                'published_at' => $publishedAt,
            ]
        );

        return true;
    }
}
