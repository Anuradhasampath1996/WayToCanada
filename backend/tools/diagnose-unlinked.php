<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$docId = (int) ($argv[1] ?? 5);
$doc = App\Models\LegislationDocument::find($docId);
if (! $doc) {
    exit("Doc not found\n");
}

$render = app(App\Services\LegislationReferenceRenderService::class);
$ai = app(App\Services\LegislationReferenceAiService::class);
$parser = app(App\Services\LegislationReferenceLabelParser::class);

$base = $render->freshBaseHtml($doc);
$stored = $doc->rendered_html ?? '';

echo "Doc {$doc->id} {$doc->act_code} {$doc->format}\n";
echo 'Base leg-ref: '.substr_count($base, 'class="leg-ref')."\n";
echo 'Stored leg-ref: '.substr_count($stored, 'class="leg-ref')."\n";

$unlinked = $ai->findUnlinkedLabels($base);
echo 'Unlinked from BASE: '.count($unlinked)."\n";
foreach (array_slice($unlinked, 0, 15) as $u) {
    $p = $parser->parse($u, $doc);
    $ok = $p ? (app(App\Services\LegislationSyncService::class)->resolveReference($p['target_act_code'], $p['target_provision_key'], $doc->language) ? 'OK' : 'NO_PROV') : 'NO_PARSE';
    echo "  [$ok] $u\n";
}

$unlinkedStored = $ai->findUnlinkedLabels($stored);
echo 'Unlinked from STORED: '.count($unlinkedStored)."\n";
foreach (array_slice($unlinkedStored, 0, 10) as $u) {
    echo "  $u\n";
}

// Sample plain text with subsection patterns not in links
preg_match_all('/>([^<]{10,200})</', $base, $chunks);
$missed = [];
foreach ($chunks[1] as $t) {
    if (preg_match('/subsection|section \d|paragraph \d|\d+\(\d+\)\s+of the Act/iu', $t) && ! str_contains($t, 'leg-ref')) {
        if (! preg_match('/class="leg-ref/', $t)) {
            $missed[] = trim($t);
        }
    }
}
echo "\nText chunks with ref-like words (sample):\n";
foreach (array_slice(array_unique($missed), 0, 10) as $m) {
    echo '  '.substr($m, 0, 120)."\n";
}
