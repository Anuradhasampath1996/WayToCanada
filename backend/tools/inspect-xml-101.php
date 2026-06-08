<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$xml = Illuminate\Support\Facades\Storage::disk('local')->get(
    App\Models\LegislationDocument::find(1)->storage_path
);

// Extract section 1 subsections
if (preg_match('/<Section[^>]*>.*?<Label>1<\/Label>([\s\S]*?)<\/Section>/', $xml, $sec)) {
    preg_match_all('/<Subsection[^>]*>.*?<Label>\(([^)]*)\)<\/Label>/s', $sec[1], $subs);
    echo "Section 1 subsections:\n".implode("\n", $subs[1])."\n";
}

// section 10.3 subsections with 1.01
if (preg_match('/<Section[^>]*>.*?<Label>10\.3<\/Label>([\s\S]*?)<\/Section>/', $xml, $sec)) {
    preg_match_all('/<Subsection[^>]*>.*?<Label>\(([^)]*)\)<\/Label>/s', $sec[1], $subs);
    echo "\nSection 10.3 subsections:\n".implode("\n", array_slice($subs[1], 0, 15))."\n";
}
