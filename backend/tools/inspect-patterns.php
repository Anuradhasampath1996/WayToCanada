<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$html = App\Models\LegislationDocument::find(1)->rendered_html ?? '';

if (preg_match('/sections 17.{0,350}/', $html, $m)) {
    echo "sections list RAW:\n".$m[0]."\n\n";
}

foreach (['or (2) or 77(1)', 'subsection (2)'] as $needle) {
    if (preg_match('/.{0,100}'.preg_quote($needle, '/').'.{0,150}/is', $html, $m)) {
        echo "$needle RAW:\n".$m[0]."\n\n";
    }
}
