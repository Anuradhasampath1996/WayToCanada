<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\IntegrationSetting;
use App\Services\IntegrationSettingsService;
use Illuminate\Support\Facades\Mail;

app(IntegrationSettingsService::class)->applyRuntimeConfig();

$mail = IntegrationSetting::decryptPayload(
    IntegrationSetting::where('group_key', 'mail')->value('payload')
);

echo "mailer=" . config('mail.default') . PHP_EOL;
echo "host=" . config('mail.mailers.smtp.host') . PHP_EOL;

$to = $argv[1] ?? ($mail['smtp_username'] ?? null);
if (! $to) {
    echo "No recipient\n";
    exit(1);
}

try {
    Mail::raw('RCICMASTER SMTP test at ' . now()->toDateTimeString(), function ($m) use ($to) {
        $m->to($to)->subject('RCICMASTER SMTP test');
    });
    echo "Sent test mail to {$to}\n";
} catch (Throwable $e) {
    echo "FAIL: " . $e->getMessage() . PHP_EOL;
    exit(1);
}
