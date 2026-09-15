<?php

/**
 * Import integrations export into production integration_settings (re-encrypt with local APP_KEY).
 * Usage: php /tmp/import-integration-settings.php /tmp/integrations-export.json
 */

require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$path = $argv[1] ?? '/tmp/integrations-export.json';
if (! is_file($path)) {
    fwrite(STDERR, "Missing export file: {$path}\n");
    exit(1);
}

$raw = file_get_contents($path);
$data = json_decode($raw, true);
if (! is_array($data) || ! isset($data['groups']) || ! is_array($data['groups'])) {
    fwrite(STDERR, "Invalid export JSON\n");
    exit(1);
}

$svc = app(App\Services\IntegrationSettingsService::class);
$adminId = App\Models\User::query()->whereHas('roles', fn ($q) => $q->where('name', 'super_admin'))->value('id')
    ?? App\Models\User::query()->orderBy('id')->value('id');

$saved = [];
foreach ($data['groups'] as $groupKey => $values) {
    if (! isset(App\Services\IntegrationSettingsService::GROUPS[$groupKey])) {
        echo "skip unknown group={$groupKey}\n";
        continue;
    }
    if (! is_array($values)) {
        continue;
    }

    $svc->updateGroup($groupKey, $values, $adminId ? (int) $adminId : null);
    $saved[] = $groupKey;
    echo "saved group={$groupKey} fields=".count($values)."\n";
}

Illuminate\Support\Facades\Cache::forget(App\Services\IntegrationSettingsService::CACHE_KEY);

echo "done groups=".implode(',', $saved)."\n";

// Verify without printing secrets
foreach ($saved as $groupKey) {
    $row = App\Models\IntegrationSetting::where('group_key', $groupKey)->first();
    $merged = $svc->merged($groupKey);
    $meta = App\Services\IntegrationSettingsService::GROUPS[$groupKey];
    $secretOk = true;
    foreach ($meta['secrets'] as $secretField) {
        $val = $merged[$secretField] ?? null;
        if (! is_string($val) || $val === '') {
            // optional secrets may be empty
            continue;
        }
        $secretOk = $secretOk && strlen($val) > 0;
    }
    echo "verify {$groupKey} source=database payload=".($row?->payload ? 'yes' : 'no')." secrets_present=".($secretOk ? 'yes' : 'partial')."\n";
}
