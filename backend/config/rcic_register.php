<?php

return [

    'profile_url' => env(
        'RCIC_REGISTER_PROFILE_URL',
        'https://register.college-ic.ca/Public-Register-EN/Licensee/Profile.aspx?ID={id}'
    ),

    'search_url' => env(
        'RCIC_REGISTER_SEARCH_URL',
        'https://register.college-ic.ca/Public-Register-EN/Public-Register-EN/RCIC_Search.aspx'
    ),

    'risia_search_url' => env(
        'RCIC_REGISTER_RISIA_SEARCH_URL',
        'https://register.college-ic.ca/Public-Register-EN/Public-Register-EN/RISIA_Search.aspx'
    ),

    'user_agent' => env(
        'RCIC_SCRAPE_USER_AGENT',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    ),

    /** Delay between HTTP requests to the CICC register (milliseconds). */
    'delay_ms' => (int) env('RCIC_SCRAPE_DELAY_MS', 1200),

    /**
     * Last-name "contains" search terms.
     * Use "*" (default) for a blank last-name search — returns the full public register.
     * Or set e.g. a,b,c to shard by letter.
     */
    'search_terms' => (static function () {
        $raw = env('RCIC_SCRAPE_SEARCH_TERMS', '*');
        if ($raw === null || $raw === '' || $raw === '*') {
            return [''];
        }

        return array_values(array_filter(array_map('trim', explode(',', (string) $raw)), fn ($t) => $t !== ''));
    })(),

    /** Also scrape the RISIA public search (same CICC register). */
    'include_risia' => filter_var(env('RCIC_SCRAPE_INCLUDE_RISIA', true), FILTER_VALIDATE_BOOL),

    /**
     * After search sync, open each Licensee Details tab to fill
     * status / city / province / email / phone.
     */
    'enrich_profiles' => filter_var(env('RCIC_SCRAPE_ENRICH_PROFILES', true), FILTER_VALIDATE_BOOL),

    /**
     * Enrich each search-result page immediately (so Status/City/Email/Phone
     * appear while sync is still running — not only after the full register).
     */
    'enrich_during_search' => filter_var(env('RCIC_SCRAPE_ENRICH_DURING_SEARCH', true), FILTER_VALIDATE_BOOL),

    /** Only enrich rows missing status/city/email/phone (recommended). */
    'enrich_only_missing' => filter_var(env('RCIC_SCRAPE_ENRICH_ONLY_MISSING', true), FILTER_VALIDATE_BOOL),

    /** How many times to retry a single request after HTTP 429/403/5xx. */
    'http_retries' => (int) env('RCIC_SCRAPE_HTTP_RETRIES', 6),

    /** Base backoff (seconds) for 429; doubles each retry. */
    '429_backoff_seconds' => (int) env('RCIC_SCRAPE_429_BACKOFF', 30),

    /** Abort the run after this many consecutive exhausted HTTP retries. */
    'max_consecutive_systemic_failures' => (int) env('RCIC_SCRAPE_MAX_SYSTEMIC_FAILURES', 8),

    'http_timeout' => (int) env('RCIC_SCRAPE_HTTP_TIMEOUT', 45),

    /** Safety cap per last-name term (0 = no cap). */
    'max_pages_per_term' => (int) env('RCIC_SCRAPE_MAX_PAGES_PER_TERM', 0),

];
