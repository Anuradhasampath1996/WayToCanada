<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$html = App\Models\LegislationDocument::find(1)->rendered_html ?? '';

$needles = ['(1) to (2)', 'to (2)', 'subsection (1.01)', 'subsection (1.1) or', '10.2(3);', 'subsections (1)'];
foreach ($needles as $n) {
    if (preg_match('/.{0,100}'.preg_quote($n, '/').'.{0,150}/is', $html, $m)) {
        echo "=== $n ===\n".$m[0]."\n\n";
    } else {
        echo "NOT FOUND: $n\n\n";
    }
}

// find section for (1.01)
if (preg_match('/<section class="leg-section" id="s-([^"]+)"[^>]*>.*?subsection \(1\.01\).*?<\/section>/is', $html, $m)) {
    echo "Section for (1.01): s-".$m[1]."\n";
}

// fresh base for (1.01)
$render = app(App\Services\LegislationReferenceRenderService::class);
$base = $render->freshBaseHtml(App\Models\LegislationDocument::find(1));
if (preg_match('/.{0,80}subsection \(1\.01\).{0,80}/', $base, $m)) {
    echo "Fresh base (1.01): ".$m[0]."\n";
}
