<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\LegislationDocument;
use App\Services\LegislationSyncService;

$sync = app(LegislationSyncService::class);

foreach ([1, 2] as $docId) {
    $doc = LegislationDocument::find($docId);
    $html = $doc->rendered_html ?? '';
    preg_match_all(
        '/data-act="([^"]*)"[^>]*data-key="([^"]*)"/iu',
        $html,
        $matches,
        PREG_SET_ORDER
    );

    echo "\nDoc {$docId}: testing 5 random link popups\n";
    $sample = array_slice($matches, 0, 5);
    foreach ($sample as $m) {
        $resolved = $sync->resolveReference($m[1], $m[2], $doc->language);
        $status = $resolved ? 'OK — '.($resolved['citation'] ?? $m[1].':'.$m[2]) : 'FAIL';
        echo "  {$m[1]}:{$m[2]} → {$status}\n";
    }

    $pending = $doc->references()->where('is_active', false)->whereNotNull('target_provision_key')->get();
    echo "Pending queue ({$pending->count()}):\n";
    foreach ($pending->take(3) as $ref) {
        echo "  - {$ref->label} → {$ref->target_act_code}:{$ref->target_provision_key}\n";
    }
}
