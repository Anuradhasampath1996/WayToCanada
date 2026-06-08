<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$doc = App\Models\LegislationDocument::find(1);
$render = app(App\Services\LegislationReferenceRenderService::class);
$html = $render->finalizeDocumentHtml($doc);
$doc->update(['rendered_html' => $html]);

$checks = [
    'range no nesting' => '/Subject to <a[^>]*>subsections \(1\)<\/a> to <a[^>]*data-key="4\(2\)"/',
    '10.2(3) linked' => '/subsections 10\.1\(3\)<\/a> and <a[^>]*data-key="10\.2\(3\)"/',
    '1.01 no nesting' => '/subject to <a[^>]*>subsection \(1\.01\)<\/a>/',
    '1.1 or 1.2' => '/data-key="11\(1\.1\)"[^>]*>subsection \(1\.1\)<\/a> or <a[^>]*data-key="11\(1\.2\)"/',
];

foreach ($checks as $label => $pattern) {
    echo "$label: ".(preg_match($pattern, $html) ? 'OK' : 'FAIL')."\n";
}

if (preg_match('/Subject to.{0,220}/i', $html, $m)) echo "\nRange:\n".$m[0]."\n";
if (preg_match('/subject to.{0,180}1\.01.{0,60}/i', $html, $m)) echo "\n1.01:\n".$m[0]."\n";
if (preg_match('/12 months.{0,220}1\.2/i', $html, $m)) echo "\n1.1/1.2:\n".$m[0]."\n";
if (preg_match('/subsections 10\.1\(3\).{0,120}/i', $html, $m)) echo "\n10.x:\n".$m[0]."\n";

// nested anchor check
$nested = preg_match('/<a[^>]*>[^<]*<a[^>]*leg-ref/', $html);
echo "\nNested anchors: ".($nested ? 'FOUND (bad)' : 'none (good)')."\n";
