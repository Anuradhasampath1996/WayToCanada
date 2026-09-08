<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$consultant = App\Models\User::where('email', 'stageg.consultant@rcicmaster.test')->firstOrFail();
$token = $consultant->createToken('stage-g-debug')->plainTextToken;

$caseFile = App\Models\ClientProfile::find(13)->caseFile;
$review = app(App\Services\GovernmentForms\ApplicationInfoReviewService::class);
if (! $review->isReviewed($caseFile)) {
    $review->markReviewed($caseFile, $consultant);
}

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$request = Illuminate\Http\Request::create(
    '/api/v1/consultant/clients/13/government-forms/IMM5476/generate',
    'POST',
    [],
    [],
    [],
    [
        'HTTP_AUTHORIZATION' => 'Bearer '.$token,
        'HTTP_ACCEPT' => 'application/json',
        'CONTENT_TYPE' => 'application/json',
    ],
    '{}',
);

$response = $kernel->handle($request);
echo 'Status: '.$response->getStatusCode().PHP_EOL;
echo $response->getContent().PHP_EOL;
$kernel->terminate($request, $response);
