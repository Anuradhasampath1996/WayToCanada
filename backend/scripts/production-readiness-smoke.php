#!/usr/bin/env php
<?php

/**
 * Production-readiness smoke: IMM 5476 + IMM 5406 through Laravel → processor → storage → download hash check.
 * Synthetic fixtures only. Run from backend: php scripts/production-readiness-smoke.php
 */

use App\Models\ClientProfile;
use App\Models\IrccPackageDocumentSubmission;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$results = [];

foreach (['IMM5476' => 'stageg', 'IMM5406' => 'stageh'] as $formCode => $prefix) {
    $consultant = User::where('email', "{$prefix}.consultant@rcicmaster.test")->first();
    $profile = ClientProfile::whereHas('user', fn ($q) => $q->where('email', "{$prefix}.client@rcicmaster.test"))->first();

    if (! $consultant || ! $profile) {
        $results[$formCode] = ['ok' => false, 'error' => "Fixture missing for {$prefix}"];
        continue;
    }

    $generationService = app(App\Services\GovernmentForms\FormGenerationService::class);
    $reviewService = app(App\Services\GovernmentForms\ApplicationInfoReviewService::class);
    $caseFile = $profile->caseFile;

    if (! $reviewService->isReviewed($caseFile)) {
        $reviewService->markReviewed($caseFile, $consultant);
    }

    try {
        $generated = $generationService->generate($consultant, $profile, $formCode);
    } catch (Throwable $e) {
        $results[$formCode] = ['ok' => false, 'error' => $e->getMessage()];
        continue;
    }

    /** @var IrccPackageDocumentSubmission $submission */
    $submission = $generated['submission'];
    $relativePath = app(App\Services\GovernmentForms\GovernmentFormStoragePathValidator::class)
        ->resolveGeneratedPath($submission->file_path, $submission->storage_disk ?: 'local');
    $absolutePath = Storage::disk($submission->storage_disk ?: 'local')->path($relativePath);
    $diskHash = hash_file('sha256', $absolutePath) ?: '';

    $results[$formCode] = [
        'ok' => $diskHash === $submission->output_sha256 && $diskHash !== '',
        'submission_id' => $submission->id,
        'profile_id' => $profile->id,
        'output_sha256' => $submission->output_sha256,
        'disk_sha256' => $diskHash,
        'hash_match' => $diskHash === $submission->output_sha256,
        'path_validated' => $relativePath === $submission->file_path,
    ];
}

$reportPath = dirname(__DIR__, 2).'/docs/government-forms-poc/PRODUCTION_READINESS_SMOKE.json';
file_put_contents($reportPath, json_encode([
    'generated_at' => date('c'),
    'results' => $results,
    'all_ok' => ! in_array(false, array_column($results, 'ok'), true),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL;

exit(collect($results)->contains(fn (array $row): bool => ($row['ok'] ?? false) !== true) ? 1 : 0);
