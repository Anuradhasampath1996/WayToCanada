<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$doc = App\Models\LegislationDocument::find(1);
$render = app(App\Services\LegislationReferenceRenderService::class);
$base = $render->freshBaseHtml($doc);

foreach (['17, 32', '150.1', 'proposed regulation'] as $n) {
    $pos = stripos($base, $n);
    echo "$n: ".($pos !== false ? 'found at '.$pos : 'NOT FOUND')."\n";
    if ($pos !== false) {
        echo substr($base, max(0,$pos-100), 250)."\n\n";
    }
}
