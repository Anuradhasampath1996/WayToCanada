<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$html = App\Models\LegislationDocument::find(1)->rendered_html ?? '';

foreach (['may not delegate', '42.1(2)', '77(1)', '6(3)'] as $needle) {
    if (preg_match('/.{0,120}'.preg_quote($needle, '/').'.{0,200}/is', $html, $m)) {
        echo "=== $needle ===\n".$m[0]."\n\n";
    }
}

// section 6 inner
if (preg_match('/<section class="leg-section" id="s-6">(.*?)<\/section>/is', $html, $m)) {
    if (preg_match_all('/subsection\s*\(\d+\)/i', $m[1], $subs)) {
        echo "subsection refs in s-6:\n".implode("\n", $subs[0])."\n\n";
    }
    if (preg_match('/Despite.{0,300}/i', $m[1], $d)) {
        echo "Despite in s-6:\n".$d[0]."\n";
    }
}
