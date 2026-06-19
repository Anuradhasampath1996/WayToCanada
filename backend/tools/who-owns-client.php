<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$p = App\Models\ClientProfile::with('user')->find(6) ?? App\Models\ClientProfile::with('user')->first();
if (! $p) { echo "no_profiles\n"; exit; }
$c = App\Models\User::find($p->consultant_id);
echo "profile={$p->id} client={$p->user?->email}\n";
echo "consultant={$c?->email} id={$c?->id}\n";
