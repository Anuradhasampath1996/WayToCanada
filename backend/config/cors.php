<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:3005',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
        'http://127.0.0.1:3003',
        'http://127.0.0.1:3005',
        'http://www.rcicmaster.com',
        'http://apply.rcicmaster.com',
        'http://rcicmaster.com',
        'http://admin.rcicmaster.com',
        'http://app.rcicmaster.com',
        'http://consultant.rcicmaster.com',
        'http://portal.rcicmaster.com',
        'https://consultant.rcicmaster.ca',
        'https://admin.rcicmaster.ca',
        'https://app.rcicmaster.ca',
        'https://apply.rcicmaster.ca',
        'https://rcicmaster.ca',
        'https://www.rcicmaster.ca',
    ],

    'allowed_origins_patterns' => [
        '#^https?://localhost:\d+$#',
        '#^https?://127\.0\.0\.1:\d+$#',
        '#^https?://10\.0\.2\.2:\d+$#',
        '#^https?://([a-z0-9-]+\.)?rcicmaster\.com$#',
        '#^https?://([a-z0-9-]+\.)?rcicmaster\.ca$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
