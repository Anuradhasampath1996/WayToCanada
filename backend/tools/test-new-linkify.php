<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$doc = App\Models\LegislationDocument::find(1);
$render = app(App\Services\LegislationReferenceRenderService::class);
$html = $render->finalizeDocumentHtml($doc);
$doc->update(['rendered_html' => $html]);

$checks = [
    'sections 17, 32' => '/sections\s+<a[^>]*>17<\/a>,\s*<a[^>]*>32<\/a>/',
    'subsection (2) linked' => '/subsection\s+<a[^>]*data-key="[^"]+\(2\)"/',
    'or (2) after 42.1' => '/42\.1\(1\)<\/a>\s+or\s+<a[^>]*data-key="42\.1\(2\)"/',
    'or 77(1)' => '/or\s+<a[^>]*data-key="77\(1\)"/',
];

foreach ($checks as $label => $pattern) {
    echo $label.': '.(preg_match($pattern, $html) ? 'OK' : 'FAIL')."\n";
}

if (preg_match('/sections 17.{0,400}/', $html, $m)) {
    echo "\nsections snippet:\n".strip_tags($m[0])."\n";
}
