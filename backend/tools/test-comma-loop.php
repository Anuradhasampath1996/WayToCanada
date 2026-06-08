<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$parser = app(App\Services\JusticeCanadaXmlParser::class);
$ref = new ReflectionClass($parser);
$m = $ref->getMethod('linkifySectionCommaList');
$m->setAccessible(true);

$list = '17, 32, 53, 61, 87.2, 102, 116, 150 and 150.1';
$text = 'sections '.$list;

$result = $m->invoke($parser, $text, 'I-2.5');
echo "Input: $text\n\nOutput:\n$result\n\n";

// simulate loop
$offset = 0;
$len = strlen($list);
$step = 0;
while ($offset < $len) {
    $rest = substr($list, $offset);
    echo "step $step offset=$offset rest=".json_encode(substr($rest,0,30))."\n";
    if (preg_match('/^\s*,\s*/', $rest, $dm)) {
        echo "  -> comma\n";
        $offset += strlen($dm[0]);
    } elseif (preg_match('/^\s+and\s+/iu', $rest, $dm)) {
        echo "  -> and\n";
        $offset += strlen($dm[0]);
    } elseif (preg_match('/^\d+(?:\.\d+)?/', $rest, $nm)) {
        echo "  -> num ".$nm[0]."\n";
        $offset += strlen($nm[0]);
    } else {
        echo "  -> BREAK no match\n";
        break;
    }
    $step++;
    if ($step > 20) break;
}
