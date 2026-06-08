<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$d = App\Models\LegislationDocument::find(1);
$html = $d->rendered_html ?? '';
if (preg_match('/subsection 14\.1\(1\)[^<]{0,80}/', $html, $m)) {
    echo "context: {$m[0]}\n";
}
if (preg_match('/(.{0,40}subsection 14\.1\(1\).{0,120})/', $html, $m)) {
    echo "full: {$m[1]}\n";
}
if (preg_match_all('/leg-ref[^>]+>subsection/', $html, $m)) {
    echo 'subsection leg-ref count: '.count($m[0])."\n";
    echo $m[0][0]."\n";
}
