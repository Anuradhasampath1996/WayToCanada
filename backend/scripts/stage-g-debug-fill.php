<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$consultant = App\Models\User::where('email', 'stageg.consultant@rcicmaster.test')->firstOrFail();
$profile = App\Models\ClientProfile::findOrFail(13);
$caseFile = $profile->caseFile;
$review = app(App\Services\GovernmentForms\ApplicationInfoReviewService::class);
if (! $review->isReviewed($caseFile)) {
    $review->markReviewed($caseFile, $consultant);
}

$version = app(App\Services\GovernmentForms\GovernmentFormRegistryService::class)->findActiveVersion('IMM5476');
$canonical = app(App\Services\GovernmentForms\CanonicalDataResolver::class)->resolve($caseFile);
$pdfFields = app(App\Services\GovernmentForms\FormMappingService::class)->mapToPdfFields($version, $canonical->values);
$xml = app(App\Services\GovernmentForms\XfaDatasetBuilder::class)->build('IMM_5476', $pdfFields);

$template = app(App\Services\GovernmentForms\GovernmentFormRegistryService::class)->resolveTemplateAbsolutePath($version);
$out = storage_path('app/private/government-forms/temp/stage-g-debug-out.pdf');
@mkdir(dirname($out), 0777, true);

$tempXml = tempnam(sys_get_temp_dir(), 'rcic_xfa_');
file_put_contents($tempXml, $xml);

$jar = config('government_forms.processor.jar_path');
$java = config('government_forms.processor.java_binary', 'java');
$cmd = [$java, '-jar', $jar, 'fill-xfa-datasets', $template, $tempXml, $out, 'append'];

$result = Illuminate\Support\Facades\Process::timeout(120)->run($cmd);

echo json_encode([
    'successful' => $result->successful(),
    'exit' => $result->exitCode(),
    'output' => substr($result->output(), 0, 1000),
    'error' => substr($result->errorOutput(), 0, 2000),
    'out_exists' => is_file($out),
    'pdf_fields_count' => count($pdfFields),
    'canonical_sample' => array_slice($canonical->values, 0, 10),
], JSON_PRETTY_PRINT).PHP_EOL;

@unlink($tempXml);
