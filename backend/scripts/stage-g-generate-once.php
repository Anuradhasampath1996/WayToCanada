<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$consultant = App\Models\User::where('email', 'stageg.consultant@rcicmaster.test')->firstOrFail();
$profile = App\Models\ClientProfile::findOrFail(13);

$review = app(App\Services\GovernmentForms\ApplicationInfoReviewService::class);
$caseFile = $profile->caseFile;
if (! $review->isReviewed($caseFile)) {
    $review->markReviewed($caseFile, $consultant);
}

try {
    $result = app(App\Services\GovernmentForms\FormGenerationService::class)->generate($consultant, $profile, 'IMM5476');
    echo json_encode([
        'ok' => true,
        'submission_id' => $result['submission']->id,
        'output_sha256' => $result['submission']->output_sha256,
        'file_path' => $result['submission']->file_path,
    ], JSON_PRETTY_PRINT).PHP_EOL;
} catch (Throwable $e) {
    echo json_encode([
        'ok' => false,
        'message' => $e->getMessage(),
        'class' => get_class($e),
        'previous' => $e->getPrevious()?->getMessage(),
    ], JSON_PRETTY_PRINT).PHP_EOL;
    exit(1);
}
