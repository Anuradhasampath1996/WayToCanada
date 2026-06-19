<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$p = App\Models\ClientProfile::find(6);
$c = App\Models\User::find($p?->consultant_id);
echo 'logo='.($c->company_logo ?? 'null')."\n";
echo 'logs='.App\Models\ClientActivityLog::where('client_profile_id', 6)->count()."\n";
