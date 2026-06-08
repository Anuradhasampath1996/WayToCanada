<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$html = App\Models\LegislationDocument::find(1)->rendered_html ?? '';
preg_match_all('/<a[^>]*class="leg-ref"[^>]*>([^<]+)<\/a>/', $html, $m);
$samples = array_slice(array_unique($m[0]), 0, 15);
foreach ($samples as $s) echo $s."\n";
echo "\n--- subsection samples ---\n";
preg_match_all('/<a[^>]*class="leg-ref"[^>]*>[^<]*subsection[^<]*<\/a>/i', $html, $m2);
foreach (array_slice($m2[0], 0, 10) as $s) echo $s."\n";
