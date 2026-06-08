<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$html = App\Models\LegislationDocument::find(1)->rendered_html ?? '';

$needles = [
    'Despite subsection (2)',
    'subsection 20.1(1)',
    'sections 17',
    'id="s-6"',
];

foreach ($needles as $needle) {
    $pos = stripos($html, $needle);
    if ($pos === false) {
        // try partial
        if ($needle === 'Despite subsection (2)') {
            if (preg_match('/Despite.{0,80}subsection.{0,80}/i', $html, $m)) {
                echo "Despite subsection context:\n".$m[0]."\n\n";
            } else {
                echo "NOT FOUND: $needle\n\n";
            }
            continue;
        }
        echo "NOT FOUND: $needle\n\n";
        continue;
    }
    $start = max(0, $pos - 50);
    echo "$needle:\n".substr($html, $start, 400)."\n\n";
}
