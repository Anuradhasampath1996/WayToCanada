<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "=== Legislation Sync Test Report ===\n\n";

echo "Documents by source/format/lang:\n";
foreach (App\Models\LegislationDocument::orderBy('source_slug')->orderBy('format')->orderBy('language')->get() as $d) {
    echo sprintf(
        "  [%d] %s | %s/%s/%s | provisions=%d | html=%s | synced=%s\n",
        $d->id,
        $d->slug,
        $d->source_slug,
        $d->format,
        $d->language,
        $d->provisions_count,
        $d->rendered_html ? strlen($d->rendered_html).' bytes' : 'NULL',
        $d->last_synced_at?->toDateTimeString() ?? 'never'
    );
}

echo "\nTotal documents: ".App\Models\LegislationDocument::count()."\n";
echo "Total provisions: ".App\Models\LegislationProvision::count()."\n";
echo "EN/FR pairs: ";
$pairs = App\Models\LegislationDocument::whereNotNull('paired_document_id')->count();
echo "{$pairs} paired\n";

$svc = app(App\Services\LegislationSyncService::class);
$refs = ['14.1(1)', '20.1(2)', '38(2)(d)', '7.1(3)(a)', '159.1'];
echo "\nReference resolution (I-2.5 / SOR-2002-227):\n";
foreach ($refs as $key) {
    $act = str_contains($key, '159') || str_contains($key, '7.1') ? 'SOR-2002-227' : 'I-2.5';
    if (preg_match('/^38/', $key)) {
        $act = 'I-2.5';
    }
    if (preg_match('/^7\.1/', $key)) {
        $act = 'SOR-2002-227';
    }
    $r = $svc->resolveReference($act, $key, 'en');
    echo '  '.$act.' '.$key.': '.($r ? 'OK — '.$r['citation'] : 'FAIL')."\n";
}

$xmlDoc = App\Models\LegislationDocument::where('format', 'xml')->where('language', 'en')->where('source_slug', 'irpa')->first();
if ($xmlDoc && $xmlDoc->rendered_html) {
    echo "\nIRPA XML link stats:\n";
    echo '  leg-ref count: '.substr_count($xmlDoc->rendered_html, 'class="leg-ref"')."\n";
    echo '  14.1(1) links: '.substr_count($xmlDoc->rendered_html, 'data-key="14.1(1)"')."\n";
    echo '  of the Act text occurrences: '.substr_count($xmlDoc->rendered_html, 'of the Act')."\n";
    echo '  of the Act leg-ref: '.preg_match_all('/leg-ref[^>]*>[^<]*of the Act</', $xmlDoc->rendered_html)."\n";
}

$irpr = App\Models\LegislationDocument::where('slug', 'irpr-en-xml')->first();
if ($irpr && $irpr->rendered_html) {
    echo "\nIRPR XML link stats:\n";
    echo '  leg-ref count: '.substr_count($irpr->rendered_html, 'class="leg-ref"')."\n";
    echo '  7.1(3)(a) links: '.substr_count($irpr->rendered_html, 'data-key="7.1(3)(a)"')."\n";
    echo '  159.1 links: '.substr_count($irpr->rendered_html, 'data-key="159.1"')."\n";
}

echo "\nEN vs FR provision parity:\n";
foreach (['irpa', 'irpr'] as $slug) {
    $en = App\Models\LegislationProvision::whereHas('document', fn ($q) => $q->where('source_slug', $slug)->where('language', 'en'))->count();
    $fr = App\Models\LegislationProvision::whereHas('document', fn ($q) => $q->where('source_slug', $slug)->where('language', 'fr'))->count();
    echo "  {$slug}: EN={$en} FR={$fr} diff=".abs($en - $fr)."\n";
}

echo "\nMissing PDF documents: ".(8 - App\Models\LegislationDocument::where('format', 'pdf')->count())." expected 4\n";

echo "\nStorage file check:\n";
foreach (App\Models\LegislationDocument::limit(4)->get() as $d) {
    $path = storage_path('app/private/'.$d->storage_path);
    echo "  {$d->slug}: ".(is_file($path) ? filesize($path).' bytes OK' : 'MISSING at '.$path)."\n";
}

echo "\nSync runs:\n";
foreach (App\Models\LegislationSyncRun::orderByDesc('id')->limit(3)->get() as $run) {
    echo sprintf(
        "  #%d %s %s — %d/%d — %s\n",
        $run->id,
        $run->status,
        $run->scope,
        $run->completed_steps,
        $run->total_steps,
        $run->error_message ?? ($run->stats ? json_encode($run->stats) : '')
    );
}
