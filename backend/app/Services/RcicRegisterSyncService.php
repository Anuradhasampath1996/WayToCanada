<?php

namespace App\Services;

use App\Jobs\RunRcicRegisterSyncJob;
use App\Models\RcicConsultant;
use App\Models\RcicRegisterSyncRun;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class RcicRegisterSyncService
{
    private int $consecutiveSystemicFailures = 0;

    private int $adaptiveDelayMs = 0;

    /** @var array<string, string> */
    private array $cookies = [];

    public function syncStatus(): array
    {
        $latest = RcicRegisterSyncRun::query()->orderByDesc('id')->first();
        $running = RcicRegisterSyncRun::query()
            ->whereIn('status', ['pending', 'running', 'cancel_requested'])
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
                'description' => 'Pages the CICC RCIC/RISIA search and enriches Status/City/Province/Email/Phone from Licensee Details as each page is scraped.',
            ],
            'config'              => [
                'delay_ms'              => (int) config('rcic_register.delay_ms'),
                'search_terms'          => config('rcic_register.search_terms'),
                'include_risia'         => (bool) config('rcic_register.include_risia'),
                'enrich_profiles'       => (bool) config('rcic_register.enrich_profiles'),
                'enrich_during_search'  => (bool) config('rcic_register.enrich_during_search'),
                'enrich_only_missing'   => (bool) config('rcic_register.enrich_only_missing'),
                'search_url'            => config('rcic_register.search_url'),
                'risia_search_url'      => config('rcic_register.risia_search_url'),
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

    public function startSyncRun(string $trigger = 'manual'): ?RcicRegisterSyncRun
    {
        if ($this->hasActiveRun()) {
            return null;
        }

        return RcicRegisterSyncRun::create([
            'status'       => 'pending',
            'trigger'      => $trigger,
            'current_step' => $trigger === 'manual_enrich'
                ? 'Queued enrich-only (Status/City/Province/Email/Phone)…'
                : 'Queued',
            'stats'        => [
                'updated'   => 0,
                'created'   => 0,
                'errors'    => 0,
                'not_found' => 0,
                'skipped'   => 0,
                'pages'     => 0,
                'queries'   => 0,
                'enriched'  => 0,
            ],
        ]);
    }

    public function startEnrichOnlyRun(): ?RcicRegisterSyncRun
    {
        return $this->startSyncRun('manual_enrich');
    }

    public function hasActiveRun(): bool
    {
        return RcicRegisterSyncRun::query()
            ->whereIn('status', ['pending', 'running', 'cancel_requested'])
            ->exists();
    }

    /**
     * Stop the active sync immediately in the DB/UI, purge queued jobs,
     * and ask any live worker to exit after its current HTTP request.
     */
    public function requestStop(): ?RcicRegisterSyncRun
    {
        $run = RcicRegisterSyncRun::query()
            ->whereIn('status', ['pending', 'running', 'cancel_requested'])
            ->orderByDesc('id')
            ->first();

        if (! $run) {
            return null;
        }

        $run->update([
            'status'        => 'cancelled',
            'finished_at'   => now(),
            'current_step'  => 'Stopped by admin',
            'error_message' => null,
        ]);

        $this->purgeQueuedSyncJobs();
        $this->releaseSyncUniqueLock();

        return $run->fresh();
    }

    private function purgeQueuedSyncJobs(): void
    {
        try {
            DB::table('jobs')
                ->where('payload', 'like', '%RunRcicRegisterSyncJob%')
                ->delete();
        } catch (\Throwable $e) {
            Log::warning('Failed to purge RCIC sync jobs on stop', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function releaseSyncUniqueLock(): void
    {
        try {
            // Laravel ShouldBeUnique cache key: laravel_unique_job:{class}:{uniqueId}
            Cache::lock('laravel_unique_job:'.RunRcicRegisterSyncJob::class.':rcic-register-sync')
                ->forceRelease();
        } catch (\Throwable $e) {
            Log::warning('Failed to release RCIC sync unique lock on stop', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * @param  array<string, int>  $stats
     */
    private function stopIfRequested(RcicRegisterSyncRun $run, array $stats): bool
    {
        $run->refresh();

        if (! in_array($run->status, ['cancel_requested', 'cancelled'], true)) {
            return false;
        }

        $run->update([
            'status'        => 'cancelled',
            'finished_at'   => $run->finished_at ?? now(),
            'stats'         => $stats,
            'current_step'  => 'Stopped by admin',
            'error_message' => null,
        ]);

        return true;
    }

    public function runSync(RcicRegisterSyncRun $run): array
    {
        return $this->executeSync($run);
    }

    private function executeSync(RcicRegisterSyncRun $run): array
    {
        $this->consecutiveSystemicFailures = 0;
        $this->cookies = [];
        $this->adaptiveDelayMs = max(0, (int) config('rcic_register.delay_ms', 1200));

        $stats = [
            'updated'   => 0,
            'created'   => 0,
            'errors'    => 0,
            'not_found' => 0,
            'skipped'   => 0,
            'pages'     => 0,
            'queries'   => 0,
            'enriched'  => 0,
        ];

        $run->refresh();
        if (in_array($run->status, ['cancelled', 'cancel_requested'], true)) {
            $this->stopIfRequested($run, $stats);

            return $stats;
        }

        // Enrich-only: fill Status/City/Province/Email/Phone for existing rows.
        if ($run->trigger === 'manual_enrich') {
            return $this->executeEnrichOnly($run, $stats);
        }

        $terms = config('rcic_register.search_terms', range('a', 'z'));
        if (! is_array($terms) || $terms === []) {
            $terms = range('a', 'z');
        }

        $sources = [
            [
                'label' => 'RCIC',
                'url'   => (string) config('rcic_register.search_url'),
            ],
        ];

        if (config('rcic_register.include_risia')) {
            $sources[] = [
                'label' => 'RISIA',
                'url'   => (string) config('rcic_register.risia_search_url'),
            ];
        }

        $totalQueries = count($sources) * count($terms);

        $started = RcicRegisterSyncRun::query()
            ->whereKey($run->id)
            ->whereNotIn('status', ['cancelled', 'cancel_requested', 'completed', 'failed'])
            ->update([
                'status'          => 'running',
                'started_at'      => now(),
                'total_steps'     => max(1, $totalQueries),
                'completed_steps' => 0,
                'current_step'    => 'Starting CICC public search scrape…',
                'stats'           => $stats,
                'error_message'   => null,
            ]);

        $run->refresh();

        if ($started === 0 || $this->stopIfRequested($run, $stats)) {
            return $stats;
        }

        $queryIndex = 0;

        foreach ($sources as $source) {
            foreach ($terms as $term) {
                if ($this->stopIfRequested($run, $stats)) {
                    return $stats;
                }

                $queryIndex++;
                $term = (string) $term;

                $run->update([
                    'completed_steps' => $queryIndex - 1,
                    'total_steps'     => max($run->total_steps, $totalQueries),
                    'current_step'    => sprintf(
                        'Searching %s %s (%d / %d queries)',
                        $source['label'],
                        $term === '' ? 'full register' : 'last-name “'.$term.'”',
                        $queryIndex,
                        $totalQueries
                    ),
                    'stats'           => $stats,
                ]);

                try {
                    $stopped = $this->scrapeSearchTerm($run, $source['url'], $source['label'], $term, $stats, $queryIndex, $totalQueries);
                    if ($stopped) {
                        return $stats;
                    }
                    $stats['queries']++;
                    $this->consecutiveSystemicFailures = 0;
                } catch (\Throwable $e) {
                    Log::warning('RCIC register search scrape failed', [
                        'source' => $source['label'],
                        'term'   => $term,
                        'error'  => $e->getMessage(),
                    ]);
                    $stats['errors']++;

                    if ($this->consecutiveSystemicFailures >= (int) config('rcic_register.max_consecutive_systemic_failures', 8)) {
                        $run->update([
                            'status'          => 'failed',
                            'finished_at'     => now(),
                            'completed_steps' => $queryIndex - 1,
                            'stats'           => $stats,
                            'error_message'   => 'Aborted after repeated systemic HTTP failures: '.$e->getMessage(),
                            'current_step'    => 'Failed',
                        ]);

                        return $stats;
                    }
                }

                $run->update([
                    'completed_steps' => $queryIndex,
                    'stats'           => $stats,
                ]);

                $this->throttle();
            }
        }

        if ($this->stopIfRequested($run, $stats)) {
            return $stats;
        }

        if (config('rcic_register.enrich_profiles', true)) {
            $this->enrichProfiles($run, $stats, $totalQueries);
            $freshStatus = $run->fresh()->status;
            if (in_array($freshStatus, ['failed', 'cancelled'], true)) {
                return $stats;
            }
        }

        if ($this->stopIfRequested($run, $stats)) {
            return $stats;
        }

        $run->update([
            'status'          => 'completed',
            'finished_at'     => now(),
            'completed_steps' => max($run->fresh()->total_steps, $totalQueries),
            'stats'           => $stats,
            'current_step'    => sprintf(
                'Complete — created %d, updated %d, enriched %d, pages %d, errors %d (DB total %d)',
                $stats['created'],
                $stats['updated'],
                $stats['enriched'],
                $stats['pages'],
                $stats['errors'],
                RcicConsultant::count()
            ),
        ]);

        return $stats;
    }

    /**
     * @param  array<string, int>  $stats
     * @return array<string, int>
     */
    private function executeEnrichOnly(RcicRegisterSyncRun $run, array $stats): array
    {
        $started = RcicRegisterSyncRun::query()
            ->whereKey($run->id)
            ->whereNotIn('status', ['cancelled', 'cancel_requested', 'completed', 'failed'])
            ->update([
                'status'          => 'running',
                'started_at'      => now(),
                'total_steps'     => 1,
                'completed_steps' => 0,
                'current_step'    => 'Enriching Licensee Details for existing consultants…',
                'stats'           => $stats,
                'error_message'   => null,
            ]);

        $run->refresh();

        if ($started === 0 || $this->stopIfRequested($run, $stats)) {
            return $stats;
        }

        $this->enrichProfiles($run, $stats, 0);

        if (in_array($run->fresh()->status, ['failed', 'cancelled'], true)) {
            return $stats;
        }

        $run->update([
            'status'          => 'completed',
            'finished_at'     => now(),
            'completed_steps' => max(1, (int) $run->fresh()->total_steps),
            'stats'           => $stats,
            'current_step'    => sprintf(
                'Enrich complete — enriched %d, errors %d, not found %d (DB total %d)',
                $stats['enriched'],
                $stats['errors'],
                $stats['not_found'],
                RcicConsultant::count()
            ),
        ]);

        return $stats;
    }

    /**
     * Fill Status / City / Province / Email / Phone from Licensee Details tab.
     *
     * @param  array<string, int>  $stats
     */
    private function enrichProfiles(RcicRegisterSyncRun $run, array &$stats, int $searchStepsDone): void
    {
        $ids = $this->missingEnrichmentProfileIds();
        $total = count($ids);

        if ($total === 0) {
            $run->update([
                'current_step' => 'Profile enrichment skipped — no missing contact/status fields.',
                'stats'        => $stats,
            ]);

            return;
        }

        $run->update([
            'total_steps'     => $searchStepsDone + $total,
            'completed_steps' => $searchStepsDone,
            'current_step'    => sprintf('Enriching Licensee Details (0 / %d)…', $total),
            'stats'           => $stats,
        ]);

        foreach ($ids as $index => $profileId) {
            if ($this->stopIfRequested($run, $stats)) {
                return;
            }

            $run->update([
                'completed_steps' => $searchStepsDone + $index,
                'current_step'    => sprintf(
                    'Enriching profile %d (%d / %d)',
                    $profileId,
                    $index + 1,
                    $total
                ),
                'stats'           => $stats,
            ]);

            $this->enrichOneProfile($run, $profileId, $stats, $searchStepsDone + $index);

            if ($run->fresh()->status === 'failed') {
                return;
            }

            $this->throttle();
        }

        $run->update([
            'completed_steps' => $searchStepsDone + $total,
            'stats'           => $stats,
        ]);
    }

    /**
     * @return list<int>
     */
    private function missingEnrichmentProfileIds(?array $limitToProfileIds = null): array
    {
        $query = RcicConsultant::query()->orderBy('profile_id');

        if ($limitToProfileIds !== null) {
            $query->whereIn('profile_id', $limitToProfileIds);
        }

        if (config('rcic_register.enrich_only_missing', true)) {
            $query->where(function ($q) {
                $q->whereNull('status')
                    ->orWhere('status', '')
                    ->orWhereNull('city')
                    ->orWhere('city', '')
                    ->orWhereNull('province')
                    ->orWhere('province', '')
                    ->orWhereNull('email')
                    ->orWhere('email', '')
                    ->orWhereNull('phone')
                    ->orWhere('phone', '');
            });
        }

        return $query->pluck('profile_id')->map(fn ($id) => (int) $id)->all();
    }

    /**
     * Enrich profiles from the latest search page so contact fields appear mid-sync.
     *
     * @param  list<int>  $profileIds
     * @param  array<string, int>  $stats
     * @return bool True when stop was requested
     */
    private function enrichProfileIdsDuringSearch(
        RcicRegisterSyncRun $run,
        array $profileIds,
        array &$stats,
        string $sourceLabel,
        string $term,
        int $pageNumber,
        int $pageCount,
        int $queryIndex,
        int $totalQueries,
    ): bool {
        if (! config('rcic_register.enrich_profiles', true)
            || ! config('rcic_register.enrich_during_search', true)
            || $profileIds === []
        ) {
            return false;
        }

        $ids = $this->missingEnrichmentProfileIds($profileIds);
        $total = count($ids);
        if ($total === 0) {
            return false;
        }

        foreach ($ids as $index => $profileId) {
            if ($this->stopIfRequested($run, $stats)) {
                return true;
            }

            $run->update([
                'current_step' => sprintf(
                    '%s %s page %d%s — enriching %d/%d (query %d/%d)',
                    $sourceLabel,
                    $term === '' ? 'full register' : '“'.$term.'”',
                    $pageNumber,
                    $pageCount ? "/{$pageCount}" : '',
                    $index + 1,
                    $total,
                    $queryIndex,
                    $totalQueries
                ),
                'stats' => $stats,
            ]);

            $this->enrichOneProfile($run, $profileId, $stats);
            if ($run->fresh()->status === 'failed') {
                return true;
            }

            $this->throttle();
        }

        return false;
    }

    /**
     * @param  array<string, int>  $stats
     */
    private function enrichOneProfile(
        RcicRegisterSyncRun $run,
        int $profileId,
        array &$stats,
        ?int $completedStepsOnFailure = null,
    ): void {
        try {
            $details = $this->fetchLicenseeDetails($profileId);
            $hasContact = isset($details['status'])
                || isset($details['city'])
                || isset($details['province'])
                || isset($details['email'])
                || isset($details['phone']);

            if ($details !== []) {
                RcicConsultant::where('profile_id', $profileId)->update($details);
            }

            if ($hasContact) {
                $stats['enriched']++;
                $stats['updated']++;
            } else {
                $stats['not_found']++;
            }
            $this->consecutiveSystemicFailures = 0;
        } catch (\Throwable $e) {
            Log::warning('RCIC profile enrich failed', [
                'profile_id' => $profileId,
                'error'      => $e->getMessage(),
            ]);
            $stats['errors']++;

            if ($this->consecutiveSystemicFailures >= (int) config('rcic_register.max_consecutive_systemic_failures', 8)) {
                $run->update([
                    'status'          => 'failed',
                    'finished_at'     => now(),
                    'completed_steps' => $completedStepsOnFailure ?? $run->completed_steps,
                    'stats'           => $stats,
                    'error_message'   => 'Aborted during profile enrichment: '.$e->getMessage(),
                    'current_step'    => 'Failed',
                ]);
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function fetchLicenseeDetails(int $profileId): array
    {
        $url = str_replace('{id}', (string) $profileId, (string) config('rcic_register.profile_url'));
        $html = $this->requestHtml('GET', $url);
        $this->throttle();

        $tabId = 'ctl01$TemplateBody$WebPartManager1$gwpciProfileCCO$ciProfileCCO$radTab_Top';
        $payload = [
            '__EVENTTARGET'        => $tabId,
            '__EVENTARGUMENT'      => '{"type":0,"index":"1"}',
            '__VIEWSTATE'          => $this->extractInputValue($html, '__VIEWSTATE'),
            '__VIEWSTATEGENERATOR' => $this->extractInputValue($html, '__VIEWSTATEGENERATOR'),
            $tabId.'_ClientState'  => '{"selectedIndexes":["1"],"logEntries":[],"scrollState":{}}',
        ];

        $eventValidation = $this->extractInputValue($html, '__EVENTVALIDATION');
        if ($eventValidation !== '') {
            $payload['__EVENTVALIDATION'] = $eventValidation;
        }

        $detailsHtml = $this->requestHtml('POST', $url, $payload);

        return $this->parseLicenseeDetailsHtml($detailsHtml);
    }

    /**
     * @return array<string, mixed>
     */
    private function parseLicenseeDetailsHtml(string $html): array
    {
        $data = [
            'scraped_at'    => now(),
            'scrape_status' => 'scraped',
        ];

        if (preg_match('/Licence\s*Status\s*<\/?[^>]*>\s*([A-Za-z][A-Za-z0-9 \/-]{1,60})/i', $html, $m)
            || preg_match('/Licence\s*Status\s+([A-Za-z][A-Za-z0-9 \/-]{1,60})/i', $html, $m)
        ) {
            $status = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5));
            $status = preg_replace('/\s+/', ' ', $status) ?: $status;
            if ($status !== '' && ! str_contains(strtolower($status), 'sign in')) {
                $data['status'] = Str::limit($status, 50, '');
            }
        }

        // Current licence history row: Class | Start | Expiry | Status
        if (
            empty($data['status'])
            && preg_match(
                '/LicenceHistory_ResultsGrid[\s\S]*?<tr class="rg(?:Alt)?Row"[^>]*>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>/i',
                $html,
                $m
            )
        ) {
            $status = trim(html_entity_decode(strip_tags($m[4]), ENT_QUOTES | ENT_HTML5));
            if ($status !== '') {
                $data['status'] = Str::limit($status, 50, '');
            }
            $type = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5));
            if ($type !== '') {
                $data['type'] = Str::limit($type, 50, '');
            }
        }

        // Employment row: Company | Start | Country | Province | City | Email | Phone
        if (preg_match(
            '/Employment_ResultsGrid[\s\S]*?<tr class="rg(?:Alt)?Row"[^>]*>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>/i',
            $html,
            $m
        )) {
            $company = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5));
            $country = trim(html_entity_decode(strip_tags($m[3]), ENT_QUOTES | ENT_HTML5));
            $province = trim(html_entity_decode(strip_tags($m[4]), ENT_QUOTES | ENT_HTML5));
            $city = trim(html_entity_decode(strip_tags($m[5]), ENT_QUOTES | ENT_HTML5));
            $emailHtml = $m[6];
            $phone = trim(html_entity_decode(strip_tags($m[7]), ENT_QUOTES | ENT_HTML5));

            if ($company !== '') {
                $data['company'] = $company;
            }
            if ($country !== '') {
                $data['country'] = Str::limit($country, 100, '');
            }
            if ($province !== '') {
                $data['province'] = Str::limit($province, 100, '');
            }
            if ($city !== '') {
                $data['city'] = Str::limit($city, 100, '');
            }
            if ($phone !== '' && $phone !== '&nbsp;') {
                $data['phone'] = Str::limit($phone, 50, '');
            }

            $email = $this->extractProtectedEmail($emailHtml);
            if ($email) {
                $data['email'] = Str::limit($email, 255, '');
            }
        }

        return array_filter($data, fn ($v) => $v !== null && $v !== '');
    }

    private function extractProtectedEmail(string $html): ?string
    {
        if (preg_match('/data-cfemail="([a-f0-9]+)"/i', $html, $m)) {
            return $this->decodeCloudflareEmail($m[1]);
        }

        if (preg_match('/mailto:([^"\'?\s]+)/i', $html, $m)) {
            return trim(html_entity_decode(urldecode($m[1]), ENT_QUOTES | ENT_HTML5));
        }

        $text = trim(html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5));
        if (filter_var($text, FILTER_VALIDATE_EMAIL)) {
            return $text;
        }

        return null;
    }

    private function decodeCloudflareEmail(string $hex): ?string
    {
        if (strlen($hex) < 4 || strlen($hex) % 2 !== 0) {
            return null;
        }

        $key = hexdec(substr($hex, 0, 2));
        $email = '';
        for ($i = 2; $i < strlen($hex); $i += 2) {
            $email .= chr(hexdec(substr($hex, $i, 2)) ^ $key);
        }

        return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
    }

    /**
     * @param  array<string, int>  $stats
     * @return bool True when stop was requested and applied
     */
    private function scrapeSearchTerm(
        RcicRegisterSyncRun $run,
        string $searchUrl,
        string $sourceLabel,
        string $term,
        array &$stats,
        int $queryIndex,
        int $totalQueries,
    ): bool {
        if ($this->stopIfRequested($run, $stats)) {
            return true;
        }

        $html = $this->requestHtml('GET', $searchUrl);
        $this->throttle();

        $html = $this->postSearch($searchUrl, $html, $term);
        $page = 0;
        $maxPages = (int) config('rcic_register.max_pages_per_term', 0);
        $seenPageIndexes = [];

        while (true) {
            if ($this->stopIfRequested($run, $stats)) {
                return true;
            }

            $meta = $this->parseGridMeta($html);
            $pageIndex = $meta['current_page_index'] ?? $page;
            if (isset($seenPageIndexes[$pageIndex])) {
                break;
            }
            $seenPageIndexes[$pageIndex] = true;

            $rows = $this->parseSearchResultRows($html);
            $pageProfileIds = [];
            foreach ($rows as $row) {
                $result = $this->upsertSearchRow($row);
                $stats[$result]++;
                if (! empty($row['profile_id'])) {
                    $pageProfileIds[] = (int) $row['profile_id'];
                }
            }

            $stats['pages']++;
            $page++;

            $pageCount = $meta['page_count'] ?? null;
            $run->update([
                'current_step' => sprintf(
                    '%s %s page %d%s — %d rows this page (query %d/%d)',
                    $sourceLabel,
                    $term === '' ? 'full register' : '“'.$term.'”',
                    $pageIndex + 1,
                    $pageCount ? "/{$pageCount}" : '',
                    count($rows),
                    $queryIndex,
                    $totalQueries
                ),
                'stats' => $stats,
            ]);

            if ($this->enrichProfileIdsDuringSearch(
                $run,
                $pageProfileIds,
                $stats,
                $sourceLabel,
                $term,
                $pageIndex + 1,
                $pageCount ?? 0,
                $queryIndex,
                $totalQueries,
            )) {
                return true;
            }

            if ($run->fresh()->status === 'failed') {
                return true;
            }

            if ($maxPages > 0 && $page >= $maxPages) {
                break;
            }

            if ($pageCount !== null && ($pageIndex + 1) >= $pageCount) {
                break;
            }

            $nextTarget = $this->extractNextPageTarget($html);
            if ($nextTarget === null) {
                break;
            }

            $this->throttle();
            $html = $this->postEvent($searchUrl, $html, $nextTarget, $term);
        }

        return false;
    }

    private function postSearch(string $searchUrl, string $html, string $lastNameTerm): string
    {
        $prefix = $this->detectSheetPrefix($html);
        $payload = [
            '__VIEWSTATE'          => $this->extractInputValue($html, '__VIEWSTATE'),
            '__VIEWSTATEGENERATOR' => $this->extractInputValue($html, '__VIEWSTATEGENERATOR'),
            $prefix.'Input0$TextBox1' => '',
            $prefix.'Input1$TextBox1' => $lastNameTerm,
            $prefix.'Input2$TextBox1' => '',
            $prefix.'Input3$TextBox1' => '',
            $prefix.'Input4$TextBox1' => '',
            $prefix.'Input5$TextBox1' => '',
            $prefix.'SubmitButton'    => 'Search',
        ];

        $eventValidation = $this->extractInputValue($html, '__EVENTVALIDATION');
        if ($eventValidation !== '') {
            $payload['__EVENTVALIDATION'] = $eventValidation;
        }

        return $this->requestHtml('POST', $searchUrl, $payload);
    }

    private function postEvent(string $searchUrl, string $html, string $eventTarget, string $lastNameTerm): string
    {
        $prefix = $this->detectSheetPrefix($html);
        $payload = [
            '__EVENTTARGET'        => $eventTarget,
            '__EVENTARGUMENT'      => '',
            '__VIEWSTATE'          => $this->extractInputValue($html, '__VIEWSTATE'),
            '__VIEWSTATEGENERATOR' => $this->extractInputValue($html, '__VIEWSTATEGENERATOR'),
            $prefix.'Input0$TextBox1' => '',
            $prefix.'Input1$TextBox1' => $lastNameTerm,
            $prefix.'Input2$TextBox1' => '',
            $prefix.'Input3$TextBox1' => '',
            $prefix.'Input4$TextBox1' => '',
            $prefix.'Input5$TextBox1' => '',
        ];

        $eventValidation = $this->extractInputValue($html, '__EVENTVALIDATION');
        if ($eventValidation !== '') {
            $payload['__EVENTVALIDATION'] = $eventValidation;
        }

        return $this->requestHtml('POST', $searchUrl, $payload);
    }

    private function detectSheetPrefix(string $html): string
    {
        if (preg_match(
            '/name="(ctl01\$TemplateBody\$WebPartManager1\$gwpciSearchLicensee\$ciSearchLicensee\$ResultsGrid\$Sheet0\$)Input1\$TextBox1"/',
            $html,
            $m
        )) {
            return $m[1];
        }

        return 'ctl01$TemplateBody$WebPartManager1$gwpciSearchLicensee$ciSearchLicensee$ResultsGrid$Sheet0$';
    }

    /**
     * @return array{virtual_item_count:?int, page_count:?int, current_page_index:?int}
     */
    private function parseGridMeta(string $html): array
    {
        $virtual = null;
        $pages = null;
        $index = null;

        if (preg_match('/VirtualItemCount\\\\?":(\d+)/', $html, $m)) {
            $virtual = (int) $m[1];
        }
        if (preg_match('/PageCount\\\\?":(\d+)/', $html, $m)) {
            $pages = (int) $m[1];
        }
        if (preg_match('/CurrentPageIndex\\\\?":(\d+)/', $html, $m)) {
            $index = (int) $m[1];
        }

        return [
            'virtual_item_count'  => $virtual,
            'page_count'          => $pages,
            'current_page_index'  => $index,
        ];
    }

    private function extractNextPageTarget(string $html): ?string
    {
        // Disabled next button includes onclick="return false;"
        if (preg_match(
            '/name="([^"]+ResultsGrid\$Grid1\$ctl00\$ctl03\$ctl01\$ctl\d+)"[^>]*title="Next Page"[^>]*onclick="return false;"/i',
            $html
        )) {
            return null;
        }

        if (preg_match(
            '/name="([^"]+ResultsGrid\$Grid1\$ctl00\$ctl03\$ctl01\$ctl\d+)"[^>]*title="Next Page"/i',
            $html,
            $m
        )) {
            return html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5);
        }

        if (preg_match(
            '/title="Next Page"[^>]*name="([^"]+)"/i',
            $html,
            $m
        )) {
            $tag = $m[0];
            if (str_contains($tag, 'return false')) {
                return null;
            }

            return html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5);
        }

        return null;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function parseSearchResultRows(string $html): array
    {
        $rows = [];

        if (! preg_match_all(
            '/<tr class="rg(?:Alt)?Row"[^>]*>\s*<td>\s*<a[^>]*href="[^"]*Profile\.aspx\?ID=(\d+)"[^>]*>.*?<\/a>\s*<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>/is',
            $html,
            $matches,
            PREG_SET_ORDER
        )) {
            return [];
        }

        foreach ($matches as $m) {
            $profileId = (int) $m[1];
            $collegeId = trim(html_entity_decode(strip_tags($m[2]), ENT_QUOTES | ENT_HTML5));
            $fullName = trim(html_entity_decode(strip_tags($m[3]), ENT_QUOTES | ENT_HTML5));
            $company = trim(html_entity_decode(strip_tags($m[4]), ENT_QUOTES | ENT_HTML5));
            $country = trim(html_entity_decode(strip_tags($m[5]), ENT_QUOTES | ENT_HTML5));
            $type = trim(html_entity_decode(strip_tags($m[6]), ENT_QUOTES | ENT_HTML5));
            $entitledRaw = strtolower(trim(strip_tags($m[7])));

            [$firstName, $lastName] = $this->splitName($fullName !== '' ? $fullName : null);

            $rows[] = [
                'profile_id'           => $profileId,
                'college_id'           => $collegeId !== '' ? Str::limit($collegeId, 20, '') : null,
                'full_name'            => $fullName !== '' ? Str::limit($fullName, 255, '') : null,
                'first_name'           => $firstName ? Str::limit($firstName, 255, '') : null,
                'last_name'            => $lastName ? Str::limit($lastName, 255, '') : null,
                'company'              => $company !== '' ? $company : null,
                'country'              => $country !== '' ? Str::limit($country, 100, '') : null,
                'type'                 => $type !== '' ? Str::limit($type, 50, '') : null,
                'entitled_to_practise' => in_array($entitledRaw, ['yes', 'y', '1', 'true'], true),
                'profile_url'          => str_replace('{id}', (string) $profileId, (string) config('rcic_register.profile_url')),
                'scrape_status'        => 'scraped',
                'scraped_at'           => now(),
            ];
        }

        return $rows;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return 'created'|'updated'|'skipped'
     */
    private function upsertSearchRow(array $row): string
    {
        $profileId = (int) ($row['profile_id'] ?? 0);
        if ($profileId <= 0) {
            return 'skipped';
        }

        $existing = RcicConsultant::where('profile_id', $profileId)->first();
        if ($existing) {
            $existing->fill($row);
            $existing->save();

            return 'updated';
        }

        RcicConsultant::create($row);

        return 'created';
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
     * @param  array<string, string>|null  $payload
     */
    private function requestHtml(string $method, string $url, ?array $payload = null): string
    {
        $retries = max(1, (int) config('rcic_register.http_retries', 6));
        $backoff = max(5, (int) config('rcic_register.429_backoff_seconds', 30));
        $lastError = 'unknown';

        for ($attempt = 1; $attempt <= $retries; $attempt++) {
            try {
                $request = $this->http();
                /** @var Response $response */
                $response = strtoupper($method) === 'POST'
                    ? $request->asForm()->post($url, $payload ?? [])
                    : $request->get($url);

                $status = $response->status();

                if (in_array($status, [429, 403], true) || $response->serverError()) {
                    $lastError = "HTTP {$status}";
                    $wait = $backoff * (2 ** ($attempt - 1));
                    $this->adaptiveDelayMs = max($this->adaptiveDelayMs, (int) config('rcic_register.delay_ms', 1200) * 2);
                    Log::warning('CICC register rate-limited/blocked; backing off', [
                        'url'     => $url,
                        'status'  => $status,
                        'attempt' => $attempt,
                        'wait_s'  => $wait,
                    ]);
                    sleep(min(300, $wait));
                    continue;
                }

                if (! $response->successful()) {
                    $lastError = "HTTP {$status}";
                    $this->consecutiveSystemicFailures++;
                    throw new \RuntimeException("HTTP {$status} from {$url}");
                }

                $this->consecutiveSystemicFailures = 0;
                $this->captureCookies($response->headers());

                return $response->body();
            } catch (\RuntimeException $e) {
                throw $e;
            } catch (\Throwable $e) {
                $lastError = $e->getMessage();
                $wait = $backoff * $attempt;
                Log::warning('CICC register request exception; retrying', [
                    'url'     => $url,
                    'attempt' => $attempt,
                    'error'   => $lastError,
                ]);
                sleep(min(120, $wait));
            }
        }

        $this->consecutiveSystemicFailures++;
        throw new \RuntimeException("Exhausted retries for {$url}: {$lastError}");
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
        $request = Http::timeout((int) config('rcic_register.http_timeout', 60))
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
        $ms = max(0, $this->adaptiveDelayMs > 0
            ? $this->adaptiveDelayMs
            : (int) config('rcic_register.delay_ms', 1200));
        if ($ms > 0) {
            usleep($ms * 1000);
        }
    }
}
