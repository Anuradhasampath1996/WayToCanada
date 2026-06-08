<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$base = app(App\Services\LegislationReferenceRenderService::class)->freshBaseHtml(App\Models\LegislationDocument::find(2));
if (preg_match_all('/alinéas?\s+[\d.()a-z]+/iu', strip_tags($base), $m)) {
    echo implode("\n", array_unique(array_slice($m[0], 0, 20)))."\n";
}

foreach (['53(f)', '53(f)', '32(d.1)'] as $k) {
    echo "$k: ".(App\Models\LegislationProvision::where('document_id',2)->where('provision_key',$k)->exists()?'yes':'no')."\n";
}
