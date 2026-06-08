<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$html = App\Models\LegislationDocument::find(1)->rendered_html ?? '';

if (preg_match('/proposed regulation made under.{0,1200}/i', $html, $m)) {
    $chunk = $m[0];
    preg_match_all('/data-key="([^"]+)"/', $chunk, $keys);
    echo "Section list keys: ".implode(', ', $keys[1])."\n";
    echo "Plain numbers left: ";
    $plain = preg_replace('/<a[^>]*>.*?<\/a>/', '', $chunk);
    preg_match_all('/\b\d+(?:\.\d+)?\b/', $plain, $nums);
    echo implode(', ', $nums[0] ?: ['none'])."\n";
}
