<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\IntegrationSetting;
use App\Services\IntegrationSettingsService;
use Illuminate\Support\Facades\Cache;

$row = IntegrationSetting::where('group_key', 'mail')->first();
$payload = IntegrationSetting::decryptPayload($row?->payload);
echo "Before mailer=" . ($payload['mailer'] ?? 'null') . PHP_EOL;

$payload['mailer'] = 'smtp';
// Keep existing SMTP fields; ensure encryption for 465
if (($payload['smtp_port'] ?? null) == 465 && empty($payload['smtp_encryption'])) {
    $payload['smtp_encryption'] = 'ssl';
}

IntegrationSetting::updateOrCreate(
    ['group_key' => 'mail'],
    ['payload' => IntegrationSetting::encryptPayload($payload)]
);

Cache::forget(IntegrationSettingsService::CACHE_KEY);
app(IntegrationSettingsService::class)->applyRuntimeConfig();

echo "After mailer=" . config('mail.default') . PHP_EOL;
echo "SMTP host=" . config('mail.mailers.smtp.host') . PHP_EOL;
echo "SMTP port=" . config('mail.mailers.smtp.port') . PHP_EOL;
echo "From=" . config('mail.from.address') . PHP_EOL;
