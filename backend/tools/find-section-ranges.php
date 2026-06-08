<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$doc = App\Models\LegislationDocument::find(1);
$base = app(App\Services\LegislationReferenceRenderService::class)->freshBaseHtml($doc);

foreach (['section 10.1 or 10.2', 'sections 10.1 to 10.3'] as $p) {
    if (preg_match('/.{0,100}'.preg_quote($p, '/').'.{0,120}/is', $base, $m)) {
        echo "Fresh: $p\n{$m[0]}\n\n";
    }
}

$parser = app(App\Services\JusticeCanadaXmlParser::class);
$html = $parser->linkifyHtmlPreservingAnchors($base, $doc->act_code, null);
foreach (['section 10.1 or 10.2', 'sections 10.1 to 10.3'] as $p) {
    if (preg_match('/.{0,150}'.preg_quote($p, '/').'.{0,150}/is', $html, $m)) {
        echo "After linkify: \n{$m[0]}\n\n";
    } elseif (preg_match('/10\.1.{0,40}10\.2/i', $html, $m)) {
        echo "Partial 10.1/10.2:\n{$m[0]}\n\n";
    }
}
