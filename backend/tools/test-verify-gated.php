<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\LegislationDocument;
use App\Services\LegislationReferenceRenderService;
use App\Services\LegislationSyncService;

$render = app(LegislationReferenceRenderService::class);
$sync   = app(LegislationSyncService::class);

foreach ([1, 2] as $docId) {
    $doc = LegislationDocument::find($docId);
    if (! $doc) {
        echo "Doc {$docId}: not found\n";
        continue;
    }

    echo "\n=== Doc {$docId} ({$doc->language}, {$doc->act_code}) ===\n";

    $result = $render->finalizeDocument($doc);
    $html   = $result['html'];

    preg_match_all(
        '/<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*data-act="([^"]*)"[^>]*data-key="([^"]*)"[^>]*>/iu',
        $html,
        $matches,
        PREG_SET_ORDER
    );

    $broken = 0;
    $checked = 0;
    foreach ($matches as $m) {
        $checked++;
        if (! $sync->canResolve($m[1], $m[2], $doc->language)) {
            $broken++;
            if ($broken <= 5) {
                echo "  BROKEN: {$m[1]}:{$m[2]}\n";
            }
        }
    }

    echo "Links in HTML: {$checked}\n";
    echo "Broken links: {$broken}\n";
    echo "Stripped: {$result['stripped']}\n";
    echo "Unresolved detected: {$result['unresolved_detected']}\n";
    echo "Unresolved queued: {$result['unresolved_queued']}\n";
    echo "Verify gated: ".($result['verify_gated'] ? 'yes' : 'no')."\n";

    if ($broken === 0) {
        echo "PASS: all links resolve\n";
    } else {
        echo "FAIL: {$broken} unresolvable links remain\n";
    }
}
