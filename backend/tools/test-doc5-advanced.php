<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$doc = App\Models\LegislationDocument::find(5);
$render = app(App\Services\LegislationReferenceRenderService::class);
$html = $render->finalizeDocumentHtml($doc);
$doc->update(['rendered_html' => $html]);

foreach (['subsection (1.01) or (1.1)', 'subject to subsection (1.1)', 'subsection (2)'] as $n) {
    if (preg_match('/.{0,100}'.preg_quote($n, '/').'.{0,120}/is', $html, $m)) {
        echo "$n:\n".$m[0]."\n\n";
    }
}

$nested = preg_match('/<a[^>]*>[^<]*<a[^>]*leg-ref/', $html);
echo "Nested anchors: ".($nested ? 'FOUND' : 'none')."\n";
