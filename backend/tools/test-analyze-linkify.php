<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$doc = App\Models\LegislationDocument::find(5);
if (! $doc) {
    echo "Doc 5 not found\n";
    exit(1);
}

$ai = app(App\Services\LegislationReferenceAiService::class);
$render = app(App\Services\LegislationReferenceRenderService::class);

$before = $ai->findUnlinkedLabels($render->freshBaseHtml($doc));
echo 'Unlinked before: '.count($before)."\n";
if ($before) {
    echo 'Sample: '.implode(' | ', array_slice($before, 0, 5))."\n";
}

$result = $ai->analyzeLinkifyAndCache($doc, false);
unset($result['rendered_html']);
echo json_encode($result, JSON_PRETTY_PRINT)."\n";
