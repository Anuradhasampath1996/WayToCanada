<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\ClientProfile;
use App\Models\User;
use App\Services\ClientActivity\ClientActivityReportPdfService;
use Illuminate\Http\Request;

$profile = ClientProfile::find(6);
if (! $profile) {
    echo "profile_not_found\n";
    exit(1);
}

$consultant = User::find($profile->consultant_id);
if (! $consultant) {
    echo "consultant_not_found\n";
    exit(1);
}

$service = app(ClientActivityReportPdfService::class);
$request = Request::create('/test', 'GET');

$start = microtime(true);
try {
    $pdf = $service->generate($profile, $consultant, $request);
    $bytes = $pdf->output();
    $elapsed = round(microtime(true) - $start, 2);
    echo "ok bytes=".strlen($bytes)." elapsed={$elapsed}s\n";
} catch (Throwable $e) {
    echo "error: ".$e->getMessage()."\n";
    echo $e->getTraceAsString()."\n";
    exit(1);
}
