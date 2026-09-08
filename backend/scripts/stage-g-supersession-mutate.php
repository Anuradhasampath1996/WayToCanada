<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\IrccPackageDocumentSubmission;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

$profileId = (int) ($argv[1] ?? 13);
$client = User::where('email', 'stageg.client@rcicmaster.test')->firstOrFail();
$qs = QuestionnaireSubmission::where('user_id', $client->id)->firstOrFail();
$main = $qs->main_data ?? [];
$main['passportFullName'] = 'Regen STAGEGTEST';
$qs->update(['main_data' => $main]);

echo json_encode(['ok' => true, 'updated_passportFullName' => $main['passportFullName'], 'profile_id' => $profileId], JSON_PRETTY_PRINT) . PHP_EOL;
