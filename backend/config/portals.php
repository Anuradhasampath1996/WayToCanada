<?php

/**
 * Public portal base URLs used for OAuth callbacks, emails, and redirects.
 * Prefer config('portals.*') over env() in application code so values survive config:cache.
 */
return [
    'admin_dashboard' => rtrim((string) env('ADMIN_DASHBOARD_URL', 'http://localhost:3001'), '/'),
    'consultant_dashboard' => rtrim((string) env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/'),
    'consultant_frontend' => rtrim((string) env('CONSULTANT_FRONTEND_URL', 'http://localhost:3003'), '/'),
    'public_frontend' => rtrim((string) env('PUBLIC_FRONTEND_URL', 'http://localhost:3000'), '/'),
    'public_dashboard' => rtrim(
        (string) env('PUBLIC_DASHBOARD_URL', env('PUBLIC_FRONTEND_URL', 'http://localhost:3002')),
        '/'
    ),
];
