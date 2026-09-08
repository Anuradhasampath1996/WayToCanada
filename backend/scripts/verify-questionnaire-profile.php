<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Support\ClientDocumentStorage;
use Illuminate\Support\Facades\Storage;

$profile = ClientProfile::findOrFail((int) ($argv[1] ?? 15));
$s = QuestionnaireSubmission::where('user_id', $profile->user_id)->firstOrFail();

$docCount = 0;
$missing = [];
$walk = function ($data, $prefix = '') use (&$walk, &$docCount, &$missing) {
    if (! is_array($data)) return;
    foreach ($data as $k => $v) {
        $path = is_string($prefix) && $prefix !== '' ? "{$prefix}.{$k}" : (string) $k;
        if (is_array($v)) {
            $walk($v, $path);
            continue;
        }
        if (is_string($v) && str_ends_with($k, 'Name') && str_contains($v, 'client-document/')) {
            $docCount++;
            if (! ClientDocumentStorage::existsOnAnyDisk($v)) {
                $missing[] = $path;
            }
        }
    }
};

foreach (['step1_data', 'main_data', 'spouse_data', 'children_data', 'accompanying_data', 'step3_data'] as $section) {
    $walk($s->{$section} ?? [], $section);
}

echo json_encode([
    'profile_id' => $profile->id,
    'is_submitted' => $s->is_submitted,
    'document_fields' => $docCount,
    'missing_files' => $missing,
    'step1_married' => $s->step1_data['married'] ?? null,
    'main_passport' => $s->main_data['passportNumber'] ?? null,
], JSON_PRETTY_PRINT)."\n";
