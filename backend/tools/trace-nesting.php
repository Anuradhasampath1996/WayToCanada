<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$html = App\Models\LegislationDocument::find(1)->rendered_html;
if (preg_match('/id="s-([^"]+)"[^>]*>[\s\S]*?subject to subsection \(1\.01\)/', $html, $m)) {
    echo "Section id: s-{$m[1]}\n";
}

// fresh finalize without double contextual
$doc = App\Models\LegislationDocument::find(1);
$parser = app(App\Services\JusticeCanadaXmlParser::class);
$render = app(App\Services\LegislationReferenceRenderService::class);
$base = $render->freshBaseHtml($doc);

$html = $parser->linkifyContextualSubsections($base, $doc->act_code);
if (preg_match('/subject to.{0,180}1\.01.{0,80}/', $html, $m)) echo "Contextual only:\n".$m[0]."\n";
