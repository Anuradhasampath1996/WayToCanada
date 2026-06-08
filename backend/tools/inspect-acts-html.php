<?php
$html = file_get_contents('https://laws-lois.justice.gc.ca/eng/acts/i.html');
preg_match_all('/href="([^"]+)"/', $html, $m);
$acts = array_filter($m[1], fn ($h) => str_contains($h, '/acts/') && ! str_contains($h, '.html') || preg_match('/\/acts\/[a-z0-9\.\-]+\/?$/i', $h));
echo "Act-like hrefs:\n";
foreach (array_unique($acts) as $h) {
    if (preg_match('/acts\/([a-z0-9\.\-]+)/i', $h, $c)) {
        echo "  $h\n";
    }
}
// also try lowercase
preg_match_all('/href="(\/eng\/acts\/[a-z0-9\.\-]+\/)"/', $html, $m2);
echo "\nRegex2 count: ".count($m2[1])."\n";
foreach (array_slice(array_unique($m2[1]), 0, 10) as $h) echo "  $h\n";

// show snippet around I-2.5
$pos = stripos($html, 'i-2.5');
if ($pos) echo "\nSnippet: ".substr($html, max(0,$pos-100), 300)."\n";
