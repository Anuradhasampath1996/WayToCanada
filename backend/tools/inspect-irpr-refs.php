<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$html = App\Models\LegislationDocument::find(5)->rendered_html ?? '';
preg_match_all('/<a[^>]*class="leg-ref"[^>]*>[^<]*of the Act[^<]*<\/a>/i', $html, $m);
echo 'of the Act links: '.count($m[0])."\n";
foreach (array_slice($m[0], 0, 5) as $s) echo $s."\n";
preg_match_all('/<a[^>]*class="leg-ref"[^>]*>subsection[^<]*<\/a>/i', $html, $m2);
echo 'subsection links: '.count($m2[0])."\n";
foreach (array_slice($m2[0], 0, 5) as $s) echo $s."\n";
