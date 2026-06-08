<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$doc = App\Models\LegislationDocument::find(5);
$ai = app(App\Services\LegislationReferenceAiService::class);
$r = $ai->analyzeLinkifyAndCache($doc, true);
unset($r['rendered_html']);
echo json_encode($r, JSON_PRETTY_PRINT)."\n";
