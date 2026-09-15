<?php

/**
 * Export local Integrations page values (env + DB merged) for production seed.
 * Usage: php deploy/export-integration-settings.php > /tmp/integrations-export.json
 */

require __DIR__.'/../backend/vendor/autoload.php';
$app = require __DIR__.'/../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$svc = app(App\Services\IntegrationSettingsService::class);
$export = [];

foreach (array_keys(App\Services\IntegrationSettingsService::GROUPS) as $groupKey) {
    $merged = $svc->merged($groupKey);
    $nonEmpty = array_filter(
        $merged,
        static fn ($v) => $v !== null && $v !== ''
    );

    if ($nonEmpty === []) {
        continue;
    }

    $export[$groupKey] = $merged;
}

$outPath = $argv[1] ?? (sys_get_temp_dir().DIRECTORY_SEPARATOR.'integrations-export.json');

$payload = json_encode([
    'exported_at' => now()->toIso8601String(),
    'source'      => 'local-merged',
    'groups'      => $export,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

if ($payload === false) {
    fwrite(STDERR, "json encode failed\n");
    exit(1);
}

file_put_contents($outPath, $payload."\n");
fwrite(STDERR, 'wrote '.$outPath.' groups='.implode(',', array_keys($export)).' bytes='.strlen($payload).PHP_EOL);
