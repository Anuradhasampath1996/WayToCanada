<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$request = Illuminate\Http\Request::create('/stage-g-proc-check', 'GET');
$response = $kernel->handle($request);

if (! Route::has('stage-g-proc-check')) {
    Route::get('/stage-g-proc-check', function () {
        $jar = config('government_forms.processor.jar_path');
        $java = config('government_forms.processor.java_binary', 'java');
        $result = Illuminate\Support\Facades\Process::timeout(30)->run([$java, '-version']);
        return response()->json([
            'proc_open' => function_exists('proc_open'),
            'disable_functions' => ini_get('disable_functions'),
            'sapi' => php_sapi_name(),
            'successful' => $result->successful(),
            'exit' => $result->exitCode(),
            'stderr' => substr($result->errorOutput(), 0, 300),
        ]);
    })->name('stage-g-proc-check');

    $request = Illuminate\Http\Request::create('/stage-g-proc-check', 'GET');
    $response = $kernel->handle($request);
}

echo $response->getContent().PHP_EOL;
