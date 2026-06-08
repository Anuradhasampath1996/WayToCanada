<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

foreach (['1(1.1)', '1(1.2)', '1(1.01)', '10.3(1.01)'] as $k) {
    $p = App\Models\LegislationProvision::where('document_id', 1)->where('provision_key', $k)->exists();
    echo "$k: ".($p ? 'yes' : 'no')."\n";
}

$html = App\Models\LegislationDocument::find(1)->rendered_html;
if (preg_match('/id="s-1"[^>]*>(.*?)<section/is', $html, $m)) {
    if (preg_match('/subsection \(1\.1\) or \(1\.2\)/', $m[1])) echo "1.1/1.2 text is IN section 1\n";
    elseif (preg_match('/subsection \(1\.1\)/', $m[1])) echo "1.1 only in section 1\n";
    else echo "1.1 not in section 1 block\n";
}

if (preg_match('/id="s-11"[^>]*>(.*?)<section/is', $html, $m)) {
    if (preg_match('/subsection \(1\.1\) or \(1\.2\)/', $m[1])) echo "1.1/1.2 text is IN section 11\n";
}
