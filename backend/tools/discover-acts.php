<?php

require __DIR__.'/../vendor/autoload.php';

$letters = array_merge(['num'], range('a', 'z'));
$base = 'https://laws-lois.justice.gc.ca/eng/acts/';
$acts = [];

foreach ($letters as $letter) {
    $file = $letter === 'num' ? 'num.html' : "{$letter}.html";
    $url = $base.$file;
    $html = @file_get_contents($url);
    if (! $html) {
        echo "SKIP: {$url}\n";
        continue;
    }
    preg_match_all('/href="([A-Za-z0-9\.\-]+)\/index\.html"/', $html, $m, PREG_SET_ORDER);
    $count = 0;
    foreach ($m as $match) {
        $code = $match[1];
        if (strlen($code) < 2 || preg_match('/^[A-Z]\.html$/i', $code)) {
            continue;
        }
        if (! isset($acts[$code])) {
            $acts[$code] = $code;
            $count++;
        }
    }
    echo strtoupper($letter).": +{$count} (total ".count($acts).")\n";
}

echo "\nTotal unique acts: ".count($acts)."\n";
