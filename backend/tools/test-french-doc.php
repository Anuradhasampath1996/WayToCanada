<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$html = App\Models\LegislationDocument::find(2)->rendered_html;
if (preg_match('/42\.1\(1\).{0,120}/', $html, $m)) echo $m[0]."\n";
echo "Total links: ".substr_count($html, 'class="leg-ref')."\n";
