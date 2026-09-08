<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$jar = config('government_forms.processor.jar_path');
$java = config('government_forms.processor.java_binary', 'java');
$template = storage_path('app/private/government-forms-poc/templates/official/imm5476-official-aca5c476b93d.pdf');

$result = Illuminate\Support\Facades\Process::timeout(120)->run([
    $java, '-jar', $jar, 'inspect', $template,
]);

echo json_encode([
    'successful' => $result->successful(),
    'exit' => $result->exitCode(),
    'java' => $java,
    'jar_exists' => is_file($jar),
    'stderr' => substr($result->errorOutput(), 0, 500),
    'stdout_len' => strlen($result->output()),
], JSON_PRETTY_PRINT).PHP_EOL;
