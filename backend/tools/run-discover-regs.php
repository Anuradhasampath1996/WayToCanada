<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$service = app(App\Services\LegislationCatalogService::class);
$result = $service->discoverRegulations();
echo json_encode($result, JSON_PRETTY_PRINT)."\n";
echo 'Stats: '.json_encode($service->catalogStats())."\n";
