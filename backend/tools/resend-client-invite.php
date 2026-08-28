<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\ClientProfile;
use App\Models\User;
use App\Services\IntegrationSettingsService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

app(IntegrationSettingsService::class)->applyRuntimeConfig();

$profileId = (int) ($argv[1] ?? 11);
$profile = ClientProfile::with('user', 'consultant')->find($profileId);
if (! $profile || ! $profile->user) {
    echo "Profile {$profileId} not found\n";
    exit(1);
}

$plain = Str::password(16);
$profile->user->update(['password' => Hash::make($plain)]);
$profile->update(['invited_at' => now()]);

$loginUrl = rtrim((string) env('PUBLIC_FRONTEND_URL', 'http://localhost:3000'), '/') . '/login';
$html = view('emails.client-invitation', [
    'client' => $profile->user,
    'password' => $plain,
    'consultant' => $profile->consultant ?? User::find($profile->consultant_id),
    'loginUrl' => $loginUrl,
])->render();

echo "mailer=" . config('mail.default') . PHP_EOL;
echo "host=" . config('mail.mailers.smtp.host') . PHP_EOL;
echo "to=" . $profile->user->email . PHP_EOL;
echo "from=" . config('mail.from.address') . PHP_EOL;

try {
    Mail::html($html, function ($m) use ($profile) {
        $m->to($profile->user->email, $profile->user->name)
            ->subject('Your RCICMASTER Client Portal Invitation');
    });
    echo "SENT_OK password={$plain}\n";
} catch (Throwable $e) {
    echo "SENT_FAIL: " . $e->getMessage() . PHP_EOL;
    exit(1);
}
