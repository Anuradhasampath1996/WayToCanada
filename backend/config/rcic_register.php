<?php

return [

    'profile_url' => env(
        'RCIC_REGISTER_PROFILE_URL',
        'https://register.college-ic.ca/Public-Register-EN/Licensee/Profile.aspx?ID={id}'
    ),

    'search_url' => env(
        'RCIC_REGISTER_SEARCH_URL',
        'https://register.college-ic.ca/Public-Register-EN/RCIC_Search.aspx'
    ),

    'user_agent' => env(
        'RCIC_SCRAPE_USER_AGENT',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    ),

    /** Delay between HTTP requests to the CICC register (milliseconds). */
    'delay_ms' => (int) env('RCIC_SCRAPE_DELAY_MS', 500),

    /** How many profile IDs above the current max to probe for new licensees. */
    'look_ahead' => (int) env('RCIC_SCRAPE_LOOK_AHEAD', 500),

    /** After parsing a profile, also search by college ID for company/country/type. */
    'enrich_via_search' => filter_var(env('RCIC_SCRAPE_ENRICH_SEARCH', true), FILTER_VALIDATE_BOOL),

    /** Abort the run after this many consecutive systemic HTTP failures (403/429/5xx). */
    'max_consecutive_systemic_failures' => (int) env('RCIC_SCRAPE_MAX_SYSTEMIC_FAILURES', 5),

    'http_timeout' => (int) env('RCIC_SCRAPE_HTTP_TIMEOUT', 45),

];
