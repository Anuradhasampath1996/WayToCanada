<?php

return [
    'enabled' => env('WORKSPACE_AI_ENABLED', false),
    'model'   => env('WORKSPACE_AI_MODEL', 'gpt-4o-mini'),
    'timeout' => (int) env('WORKSPACE_AI_TIMEOUT', 90),
];
