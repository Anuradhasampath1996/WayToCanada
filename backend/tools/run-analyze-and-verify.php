<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\LegislationDocument;
use App\Services\LegislationReferenceAiService;
use App\Services\LegislationSyncService;

$ai   = app(LegislationReferenceAiService::class);
$sync = app(LegislationSyncService::class);

$docIds = array_slice($argv, 1);
if ($docIds === []) {
    $docIds = [1, 2];
}

foreach ($docIds as $docId) {
    $doc = LegislationDocument::find((int) $docId);
    if (! $doc) {
        echo "Doc {$docId}: not found\n";
        continue;
    }

    echo "\n=== Analyzing doc {$docId} ({$doc->language}, {$doc->act_code}) ===\n";

    $result = $ai->analyzeLinkifyAndCache($doc, false, function (array $p) {
        if (($p['percent'] ?? 0) % 20 === 0 || ($p['step'] ?? '') === 'done') {
            echo "  [{$p['percent']}%] {$p['message']}\n";
        }
    });

    echo json_encode($result, JSON_PRETTY_PRINT)."\n";

    $html = $doc->fresh()->rendered_html ?? '';
    preg_match_all(
        '/data-act="([^"]*)"[^>]*data-key="([^"]*)"/iu',
        $html,
        $matches,
        PREG_SET_ORDER
    );

    $broken = 0;
    foreach ($matches as $m) {
        if (! $sync->canResolve($m[1], $m[2], $doc->language)) {
            $broken++;
            if ($broken <= 3) {
                echo "  BROKEN LINK: {$m[1]}:{$m[2]}\n";
            }
        }
    }

    $pending = $doc->references()
        ->where('is_active', false)
        ->whereNotNull('target_provision_key')
        ->count();

    echo "Links: ".count($matches).", broken: {$broken}, pending queue: {$pending}\n";
    echo ($broken === 0 ? "PASS\n" : "FAIL\n");
}
