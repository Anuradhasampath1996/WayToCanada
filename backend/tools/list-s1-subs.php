<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

foreach (['1.01', '1.1', '1.2', 'h.1'] as $s) {
    $rows = App\Models\LegislationProvision::where('document_id', 1)
        ->where('provision_key', 'like', "%$s%")
        ->limit(5)
        ->pluck('provision_key');
    echo "$s: ".$rows->implode(', ')."\n";
}
