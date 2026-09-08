<?php

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Process;

$jar = config('government_forms.processor.jar_path');
$java = 'C:\\Program Files\\Common Files\\Oracle\\Java\\javapath\\java.exe';
$template = storage_path('app/private/government-forms-poc/templates/official/imm5476-official-aca5c476b93d.pdf');

echo "PHP_SAPI=" . PHP_SAPI . PHP_EOL;
echo "jar_exists=" . (is_file($jar) ? 'yes' : 'no') . PHP_EOL;
echo "template_exists=" . (is_file($template) ? 'yes' : 'no') . PHP_EOL;

$variants = [
    'direct' => [$java, '-jar', $jar, 'inspect', $template],
    'cmd_array' => ['cmd', '/c', $java, '-jar', $jar, 'inspect', $template],
    'cmd_shell' => sprintf('cmd /c ""%s" -jar "%s" inspect "%s""', $java, $jar, $template),
];

foreach ($variants as $name => $command) {
    echo "\n--- {$name} ---\n";
    $result = is_array($command)
        ? Process::timeout(60)->run($command)
        : Process::timeout(60)->run($command);

    echo "exit={$result->exitCode()}\n";
    echo "out=" . substr(trim($result->output()), 0, 200) . "\n";
    echo "err=" . substr(trim($result->errorOutput()), 0, 200) . "\n";
}
