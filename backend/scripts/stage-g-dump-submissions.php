<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\IrccPackageDocumentSubmission;
use Illuminate\Support\Facades\Storage;

$ids = array_map('intval', array_slice($argv, 1) ?: [8, 9]);
$out = [];

foreach ($ids as $id) {
    $s = IrccPackageDocumentSubmission::with('governmentFormVersion')->find($id);
    if (! $s) {
        $out[$id] = ['found' => false];
        continue;
    }
    $disk = Storage::disk($s->storage_disk ?: 'local');
    $out[$id] = [
        'found' => true,
        'case_file_id' => $s->case_file_id,
        'form_code' => $s->governmentFormVersion?->form_code,
        'form_version' => $s->governmentFormVersion?->version_label,
        'mapping_version' => $s->mapping_version,
        'source_template_hash' => $s->source_template_hash,
        'source_data_hash' => $s->source_data_hash,
        'output_sha256' => $s->output_sha256,
        'storage_disk' => $s->storage_disk,
        'file_path' => $s->file_path,
        'file_exists' => $s->file_path ? $disk->exists($s->file_path) : false,
        'generation_status' => $s->generation_status,
        'review_status' => $s->review_status,
        'generated_by' => $s->generated_by,
        'supersedes_id' => $s->supersedes_id,
    ];
}

echo json_encode($out, JSON_PRETTY_PRINT) . PHP_EOL;
