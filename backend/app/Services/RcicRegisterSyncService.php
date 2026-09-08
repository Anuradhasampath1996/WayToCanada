<?php

namespace App\Services;

use App\Models\RcicConsultant;
use App\Models\RcicRegisterSyncRun;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class RcicRegisterSyncService
{
    private int $consecutiveSystemicFailures = 0;

    /** @var array<string, string> */
    private array $cookies = [];

    public function syncStatus(): array
    {
        $latest = RcicRegisterSyncRun::query()->orderByDesc('id')->first();
        $running = RcicRegisterSyncRun::query()
            ->whereIn('status', ['pending', 'running'])
            ->orderByDesc('id')
            ->first();

        $lastSuccess = RcicRegisterSyncRun::query()
            ->where('status', 'completed')
            ->orderByDesc('finished_at')
            ->first();

        return [
            'total_records'       => RcicConsultant::count(),
            'entitled_count'      => RcicConsultant::where('entitled_to_practise', true)->count(),
            'last_scraped_at'     => RcicConsultant::max('scraped_at'),
            'scrape_error_count'  => RcicConsultant::where('scrape_status', 'error')->count(),
            'is_running'          => (bool) $running,
            'latest_run'          => $latest ? $this->formatSyncRun($latest) : null,
            'running_run'         => $running ? $this->formatSyncRun($running) : null,
            'last_successful_run' => $lastSuccess ? $this->formatSyncRun($lastSuccess) : null,
            'auto_sync'           => [
                'command'     => 'rcic:sync-register',
                'schedule'    => 'Weekly on Sunday at 2:00 AM (America/Toronto)',
                'description' => 'Scrapes the CICC public register profile pages, upserts by profile_id, and probes for newly issued profile IDs.',
            ],
            'config'              => [
                'delay_ms'          => (int) config('rcic_register.delay_ms'),
                'look_ahead'        => (int) config('rcic_register.look_ahead'),
                'enrich_via_search' => (bool) config('rcic_register.enrich_via_search'),
                'profile_url'       => config('rcic_register.profile_url'),
            ],
        ];
    }

    public function formatSyncRun(RcicRegisterSyncRun $run): array
    {
        return [
            'id'               => $run->id,
            'status'           => $run->status,
            'trigger'          => $run->trigger,
            'total_steps'      => $run->total_steps,
            'completed_steps'  => $run->completed_steps,
            'progress_percent' => $run->progressPercent(),
            'current_step'     => $run->current_step,
            'stats'            => $run->stats,
            'error_message'    => $run->error_message,
            'started_at'       => $run->started_at?->toIso8601String(),
            'finished_at'      => $run->finished_at?->toIso8601String(),
        ];
    }

    /**
     * Create a pending run if none is active. Returns null when already running.
     */
    public function startSyncRun(string $trigger = 'manual'): ?RcicRegisterSyncRun
    {
        if ($this->hasActiveRun()) {
            return null;
        }

        return RcicRegisterSyncRun::create([
            'status'         => 'pending',
            'trigger'        => $trigger,
            'current_step'   => 'Queued',
            'stats'          => [
                'updated'   => 0,
                'created'   => 0,
                'errors'    => 0,
                'not_found' => 0,
                'skipped'   => 0,
            ],
        ]);
    }

    public function hasActiveRun(): bool
    {
        return RcicRegisterSyncRun::query()
            ->whereIn('status', ['pending', 'running'])
            ->exists();
    }

    /**
     * Execute a full sync for the given run (called by the queue job / --sync).
     */
    public function runSync(RcicRegisterSyncRun $run): array
    {
        return $this->executeSync($run);
    }

    private function executeSync(RcicRegisterSyncRun $run): array
    {
        $this->consecutiveSystemicFailures = 0;
        $this->cookies = [];

        $stats = [
            'updated'   => 0,
            'created'   => 0,
            'errors'    => 0,
            'not_found' => 0,
            'skipped'   => 0,
        ];

        $knownIds = RcicConsultant::query()
            ->orderBy('profile_id')
            ->pluck('profile_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $maxId = empty($knownIds) ? 0 : max($knownIds);
        $lookAhead = max(0, (int) config('rcic_register.look_ahead', 500));
        $discoverIds = [];
        for ($id = $maxId + 1; $id <= $maxId + $lookAhead; $id++) {
            $discoverIds[] = $id;
        }

        $allIds = array_values(array_unique(array_merge($knownIds, $discoverIds)));
        $knownSet = array_fill_keys($knownIds, true);

        $run->update([
            'status'          => 'running',
            'started_at'      => now(),
            'total_steps'     => count($allIds),
            'completed_steps' => 0,
            'current_step'    => 'Starting CICC register scrape…',
            'stats'           => $stats,
            'error_message'   => null,
        ]);

        foreach ($allIds as $index => $profileId) {
            $isKnown = isset($knownSet[$profileId]);
            $run->update([
                'completed_steps' => $index,
                'current_step'    => sprintf(
                    'Scraping profile %d (%d / %d)%s',
                    $profileId,
                    $index + 1,
                    count($allIds),
                    $isKnown ? '' : ' [discover]'
                ),
                'stats'           => $stats,
            ]);

            try {
                $result = $this->scrapeAndUpsert($profileId, $isKnown);
                $stats[$result]++;
            } catch (\Throwable $e) {
                Log::warning('RCIC register scrape failed for profile', [
                    'profile_id' => $profileId,
                    'error'      => $e->getMessage(),
                ]);
                $stats['errors']++;

                if ($this->consecutiveSystemicFailures >= (int) config('rcic_register.max_consecutive_systemic_failures', 5)) {
                    $run->update([
                        'status'          => 'failed',
                        'finished_at'     => now(),
                        'completed_steps' => $index,
                        'stats'           => $stats,
                        'error_message'   => 'Aborted after repeated systemic HTTP failures: '.$e->getMessage(),
                        'current_step'    => 'Failed',
                    ]);

                    return $stats;
                }
            }

            $this->throttle();
        }

        $run->update([
            'status'          => 'completed',
            'finished_at'     => now(),
            'completed_steps' => count($allIds),
            'stats'           => $stats,
            'current_step'    => sprintf(
                'Complete — created %d, updated %d, errors %d, not found %d',
                $stats['created'],
                $stats['updated'],
                $stats['errors'],
                $stats['not_found']
            ),
        ]);

        return $stats;
    }

    /**
     * @return 'created'|'updated'|'errors'|'not_found'|'skipped'
     */
    private function scrapeAndUpsert(int $profileId, bool $isKnown): string
    {
        $html = $this->fetchProfileHtml($profileId);

        if ($html === null) {
            return 'errors';
        }

        $parsed = $this->parseProfileHtml($profileId, $html);

        if ($parsed === null) {
            if ($isKnown) {
                RcicConsultant::where('profile_id', $profileId)->update([
                    'scrape_status' => 'error',
                    'scraped_at'    => now(),
                ]);
            }

            return 'not_found';
        }

        if (config('rcic_register.enrich_via_search') && ! empty($parsed['college_id'])) {
            $this->throttle();
            $enriched = $this->searchByCollegeId($parsed['college_id']);
            if ($enriched) {
                foreach ($enriched as $key => $value) {
                    if ($value === null || $value === '') {
                        continue;
                    }
                    $parsed[$key] = $value;
                }
            }
        }

        $existing = RcicConsultant::where('profile_id', $profileId)->first();

        if ($existing) {
            $existing->fill($parsed);
            $existing->save();

            return 'updated';
        }

        RcicConsultant::create($parsed);

        return 'created';
    }

    private function fetchProfileHtml(int $profileId): ?string
    {
        $url = str_replace('{id}', (string) $profileId, (string) config('rcic_register.profile_url'));

        $response = $this->http()->get($url);

        if ($response->status() === 403 || $response->status() === 429 || $response->serverError()) {
            $this->consecutiveSystemicFailures++;
            throw new \RuntimeException('Systemic HTTP '.$response->status().' from CICC profile '.$profileId);
        }

        if (! $response->successful()) {
            $this->consecutiveSystemicFailures++;
            throw new \RuntimeException('HTTP '.$response->status().' fetching profile '.$profileId);
        }

        $this->consecutiveSystemicFailures = 0;
        $this->captureCookies($response->headers());

        return $response->body();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function parseProfileHtml(int $profileId, string $html): ?array
    {
        if (! preg_match('/College\s*ID/i', $html)) {
            return null;
        }

        $collegeId = null;
        if (preg_match('/College\s*ID\s*(?:<\/span>)?\s*[-–—:]\s*([A-Z]?\d{4,})/i', $html, $m)) {
            $collegeId = strtoupper(trim($m[1]));
        } elseif (preg_match('/\b(R\d{5,})\b/', $html, $m)) {
            $collegeId = strtoupper($m[1]);
        }

        $fullName = null;
        if (preg_match('/<span[^>]*style="[^"]*font-size:\s*32px[^"]*"[^>]*>([^<]{2,200})<\/span>/i', $html, $m)) {
            $fullName = html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5);
            $fullName = preg_replace('/\s+/', ' ', $fullName) ?: $fullName;
        }

        $type = null;
        if (preg_match('/Type(?:<\/span>)?\s*(?:<span[^>]*>)?\s*(?:&nbsp;|\s)*[-–—:]\s*(?:<\/span>)?\s*(?:<span[^>]*>)?\s*([^<\n]{1,80})/i', $html, $m)) {
            $type = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5));
            $type = preg_replace('/\s+/', ' ', $type) ?: $type;
        }

        $entitled = null;
        if (preg_match('/NOT\s+Eligible\s+to\s+Provide\s+Service/i', $html)) {
            $entitled = false;
        } elseif (preg_match('/Eligible\s+to\s+Provide\s+Service/i', $html)) {
            $entitled = true;
        }

        if ($collegeId === null && $fullName === null) {
            return null;
        }

        [$firstName, $lastName] = $this->splitName($fullName);

        $data = [
            'profile_id'    => $profileId,
            'college_id'    => $collegeId ? Str::limit($collegeId, 20, '') : null,
            'full_name'     => $fullName ? Str::limit($fullName, 255, '') : null,
            'first_name'    => $firstName ? Str::limit($firstName, 255, '') : null,
            'last_name'     => $lastName ? Str::limit($lastName, 255, '') : null,
            'type'          => $type ? Str::limit($type, 50, '') : null,
            'profile_url'   => str_replace('{id}', (string) $profileId, (string) config('rcic_register.profile_url')),
            'scrape_status' => 'scraped',
            'scraped_at'    => now(),
        ];

        if ($entitled !== null) {
            $data['entitled_to_practise'] = $entitled;
        }

        return array_filter($data, fn ($v) => $v !== null);
    }

    /**
     * @return array{0: ?string, 1: ?string}
     */
    private function splitName(?string $fullName): array
    {
        if ($fullName === null || $fullName === '') {
            return [null, null];
        }

        $parts = preg_split('/\s+/', trim($fullName), 2) ?: [];

        return [$parts[0] ?? null, $parts[1] ?? null];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function searchByCollegeId(string $collegeId): ?array
    {
        try {
            $searchUrl = (string) config('rcic_register.search_url');
            $get = $this->http()->get($searchUrl);
            if (! $get->successful()) {
                return null;
            }
            $this->captureCookies($get->headers());
            $html = $get->body();

            $viewState = $this->extractInputValue($html, '__VIEWSTATE');
            $viewStateGen = $this->extractInputValue($html, '__VIEWSTATEGENERATOR');
            $eventValidation = $this->extractInputValue($html, '__EVENTVALIDATION');

            $prefix = 'ctl01$TemplateBody$WebPartManager1$gwpciSearchLicensee$ciSearchLicensee$ResultsGrid$Sheet0$';

            $payload = [
                '__VIEWSTATE'          => $viewState,
                '__VIEWSTATEGENERATOR' => $viewStateGen,
                $prefix.'Input0$TextBox1' => '',
                $prefix.'Input1$TextBox1' => '',
                $prefix.'Input2$TextBox1' => $collegeId,
                $prefix.'Input3$TextBox1' => '',
                $prefix.'Input4$TextBox1' => '',
                $prefix.'Input5$TextBox1' => '',
                $prefix.'SubmitButton'    => 'Search',
            ];

            if ($eventValidation !== '') {
                $payload['__EVENTVALIDATION'] = $eventValidation;
            }

            $post = $this->http()
                ->asForm()
                ->post($searchUrl, $payload);

            if (! $post->successful()) {
                return null;
            }

            $this->captureCookies($post->headers());

            return $this->parseSearchResultRow($post->body(), $collegeId);
        } catch (\Throwable $e) {
            Log::debug('RCIC search enrich failed', [
                'college_id' => $collegeId,
                'error'      => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function parseSearchResultRow(string $html, string $collegeId): ?array
    {
        $escaped = preg_quote($collegeId, '/');
        if (! preg_match(
            '/<tr class="rg(?:Alt)?Row"[^>]*>\s*<td>\s*<a[^>]*href="[^"]*Profile\.aspx\?ID=(\d+)"[^>]*>.*?<\/a>\s*<\/td>\s*<td>\s*'.
            $escaped.
            '\s*<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>/is',
            $html,
            $m
        )) {
            return null;
        }

        $fullName = trim(html_entity_decode(strip_tags($m[2]), ENT_QUOTES | ENT_HTML5));
        $company = trim(html_entity_decode(strip_tags($m[3]), ENT_QUOTES | ENT_HTML5));
        $country = trim(html_entity_decode(strip_tags($m[4]), ENT_QUOTES | ENT_HTML5));
        $type = trim(html_entity_decode(strip_tags($m[5]), ENT_QUOTES | ENT_HTML5));
        $entitledRaw = strtolower(trim(strip_tags($m[6])));

        [$firstName, $lastName] = $this->splitName($fullName !== '' ? $fullName : null);

        return [
            'full_name'            => $fullName !== '' ? Str::limit($fullName, 255, '') : null,
            'first_name'           => $firstName ? Str::limit($firstName, 255, '') : null,
            'last_name'            => $lastName ? Str::limit($lastName, 255, '') : null,
            'company'              => $company !== '' ? $company : null,
            'country'              => $country !== '' ? Str::limit($country, 100, '') : null,
            'type'                 => $type !== '' ? Str::limit($type, 50, '') : null,
            'entitled_to_practise' => in_array($entitledRaw, ['yes', 'y', '1', 'true'], true),
        ];
    }

    private function extractInputValue(string $html, string $name): string
    {
        $quoted = preg_quote($name, '/');
        if (preg_match('/(?:name|id)="'.$quoted.'"[^>]*value="([^"]*)"/i', $html, $m)) {
            return html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5);
        }
        if (preg_match('/value="([^"]*)"[^>]*(?:name|id)="'.$quoted.'"/i', $html, $m)) {
            return html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5);
        }

        return '';
    }

    private function http(): PendingRequest
    {
        $request = Http::timeout((int) config('rcic_register.http_timeout', 45))
            ->withHeaders([
                'User-Agent'      => (string) config('rcic_register.user_agent'),
                'Accept'          => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language' => 'en-CA,en;q=0.9',
            ])
            ->withOptions(['allow_redirects' => true]);

        if ($this->cookies !== []) {
            $request = $request->withHeaders([
                'Cookie' => collect($this->cookies)->map(fn ($v, $k) => $k.'='.$v)->implode('; '),
            ]);
        }

        return $request;
    }

    /** @param  array<string, mixed>  $headers */
    private function captureCookies(array $headers): void
    {
        $setCookies = $headers['Set-Cookie'] ?? $headers['set-cookie'] ?? [];
        if (is_string($setCookies)) {
            $setCookies = [$setCookies];
        }

        foreach ($setCookies as $cookie) {
            if (preg_match('/^([^=]+)=([^;]*)/', $cookie, $m)) {
                $this->cookies[$m[1]] = $m[2];
            }
        }
    }

    private function throttle(): void
    {
        $ms = max(0, (int) config('rcic_register.delay_ms', 500));
        if ($ms > 0) {
            usleep($ms * 1000);
        }
    }
}
