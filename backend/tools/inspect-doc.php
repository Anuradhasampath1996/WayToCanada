<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$id = (int) ($argv[1] ?? 1);
$d = App\Models\LegislationDocument::find($id);
if (! $d) {
    echo "Document $id not found\n";
    exit(1);
}
echo "id={$d->id} format={$d->format} act={$d->act_code} lang={$d->language}\n";
echo 'html_len='.strlen($d->rendered_html ?? '')."\n";
echo 'leg-ref count='.substr_count($d->rendered_html ?? '', 'class="leg-ref"')."\n";
$html = $d->rendered_html ?? '';
if (preg_match('/class="leg-ref"[^>]*>[^<]+/', $html, $m)) {
    echo "sample ref: {$m[0]}\n";
} else {
    echo "NO leg-ref found in HTML\n";
    echo substr($html, 0, 1500)."\n";
}
