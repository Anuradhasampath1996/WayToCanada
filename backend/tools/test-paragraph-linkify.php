<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$docId = (int) ($argv[1] ?? 5);
$doc = App\Models\LegislationDocument::find($docId);
if (! $doc) {
    fwrite(STDERR, "Document {$docId} not found.\n");
    exit(1);
}

$render = app(App\Services\LegislationReferenceRenderService::class);
$result = $render->finalizeDocument($doc);
$doc->update(['rendered_html' => $result['html']]);

echo "Document {$docId} ({$doc->act_code}) re-linkified.\n";
echo "Stripped broken: {$result['stripped']}\n";
echo "Unresolved queued: {$result['unresolved_queued']}\n\n";

$sample = 'paragraphs 190(3)(b), (b.1), (c), (d), (f), (g) or (h)';
if (preg_match('/'.preg_quote($sample, '/').'.{0,800}/', strip_tags(str_replace(['</a>', '<a '], [' [/a] ', ' [a '], $result['html']), ' '), $m)) {
    echo "Sample context:\n{$m[0]}\n\n";
}

$checks = [
    '190(3)(b) anchor'   => '/data-key="190\(3\)\(b\)">paragraphs 190\(3\)\(b\)<\/a>/',
    '(b.1) linked'       => '/,\s*<a[^>]*data-key="190\(3\)\(b\.1\)"/',
    '(c) linked'         => '/,\s*<a[^>]*data-key="190\(3\)\(c\)"/',
    '(d) linked'         => '/,\s*<a[^>]*data-key="190\(3\)\(d\)"/',
    '(h) or-linked'      => '/or\s+<a[^>]*data-key="190\(3\)\(h\)"/',
];

foreach ($checks as $label => $pattern) {
    $matched = (bool) preg_match($pattern, $result['html']);
    $expect  = str_contains($label, 'unlinked') ? ! $matched : $matched;
    echo $label.': '.($expect ? 'OK' : 'FAIL')."\n";
}
