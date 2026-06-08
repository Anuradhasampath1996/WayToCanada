<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$doc = App\Models\LegislationDocument::find(1);
$render = app(App\Services\LegislationReferenceRenderService::class);
$base = $render->freshBaseHtml($doc);

if (preg_match('/made under sections.{0,200}/i', $base, $m)) {
    echo "RAW in fresh:\n".$m[0]."\n\n";
}

$parser = app(App\Services\JusticeCanadaXmlParser::class);
$text = 'The Minister shall cause a copy of each proposed regulation made under sections 17, 32, 53, 61, 87.2, 102, 116, 150 and 150.1 to be laid';
$ref = new ReflectionClass($parser);
$m = $ref->getMethod('linkifyPlainText');
$m->setAccessible(true);
echo "linkifyPlainText result:\n".$m->invoke($parser, $text, 'I-2.5', null)."\n";
