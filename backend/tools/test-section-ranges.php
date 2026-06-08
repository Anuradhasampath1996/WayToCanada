<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$html = app(App\Services\LegislationReferenceRenderService::class)->finalizeDocumentHtml(App\Models\LegislationDocument::find(1));

if (preg_match('/.{0,50}section 10\.1.{0,80}10\.2.{0,50}/is', $html, $m)) {
    echo $m[0]."\n";
}

preg_match_all('/data-key="(10\.[123])"/', $html, $keys);
echo "Keys 10.1/10.2/10.3 count: ".count($keys[1])."\n";
