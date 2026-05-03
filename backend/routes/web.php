<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;

Route::get('/', function () {
    $checks = [];

    // ── PHP Version ──────────────────────────────────────────────────
    $phpVersion = PHP_VERSION;
    $phpOk = version_compare($phpVersion, '8.2.0', '>=');
    $checks[] = [
        'name'    => 'PHP Version',
        'value'   => 'PHP ' . $phpVersion,
        'status'  => $phpOk ? 'ok' : 'error',
        'message' => $phpOk ? 'Meets minimum requirement (8.2+)' : 'Requires PHP 8.2 or higher',
    ];

    // ── Laravel Version ───────────────────────────────────────────────
    $checks[] = [
        'name'    => 'Laravel Version',
        'value'   => app()->version(),
        'status'  => 'ok',
        'message' => 'Framework loaded successfully',
    ];

    // ── Environment ───────────────────────────────────────────────────
    $env = app()->environment();
    $checks[] = [
        'name'    => 'Environment',
        'value'   => strtoupper($env),
        'status'  => $env === 'production' ? 'warning' : 'ok',
        'message' => $env === 'production' ? 'Running in production mode' : 'Running in ' . $env . ' mode',
    ];

    // ── .env File ─────────────────────────────────────────────────────
    $envFileExists = file_exists(base_path('.env'));
    $checks[] = [
        'name'    => '.env File',
        'value'   => $envFileExists ? 'Found' : 'Missing',
        'status'  => $envFileExists ? 'ok' : 'error',
        'message' => $envFileExists ? '.env configuration file exists' : '.env file not found — copy .env.example',
    ];

    // ── App Key ───────────────────────────────────────────────────────
    $appKey = config('app.key');
    $appKeyOk = !empty($appKey);
    $checks[] = [
        'name'    => 'App Key',
        'value'   => $appKeyOk ? '••••••••••••••••' : 'Not Set',
        'status'  => $appKeyOk ? 'ok' : 'error',
        'message' => $appKeyOk ? 'Application key is configured' : 'Run: php artisan key:generate',
    ];

    // ── Database Connections ──────────────────────────────────────────
    $dbConnections = ['cws', 'lms', 'legal'];
    foreach ($dbConnections as $conn) {
        try {
            DB::connection($conn)->getPdo();
            $dbName = config("database.connections.{$conn}.database");
            $checks[] = [
                'name'    => 'Database: ' . strtoupper($conn),
                'value'   => $dbName,
                'status'  => 'ok',
                'message' => 'Connected successfully',
            ];
        } catch (\Exception $e) {
            $checks[] = [
                'name'    => 'Database: ' . strtoupper($conn),
                'value'   => config("database.connections.{$conn}.database", $conn),
                'status'  => 'error',
                'message' => $e->getMessage(),
            ];
        }
    }

    // ── Storage Writable ─────────────────────────────────────────────
    $storageWritable = is_writable(storage_path());
    $checks[] = [
        'name'    => 'Storage Directory',
        'value'   => $storageWritable ? 'Writable' : 'Not Writable',
        'status'  => $storageWritable ? 'ok' : 'error',
        'message' => $storageWritable ? 'Storage path is writable' : 'Run: chmod -R 775 storage/',
    ];

    // ── Cache Driver ─────────────────────────────────────────────────
    $cacheDriver = config('cache.default');
    $checks[] = [
        'name'    => 'Cache Driver',
        'value'   => strtoupper($cacheDriver),
        'status'  => 'ok',
        'message' => 'Cache driver is configured',
    ];

    // ── Queue Driver ─────────────────────────────────────────────────
    $queueDriver = config('queue.default');
    $checks[] = [
        'name'    => 'Queue Driver',
        'value'   => strtoupper($queueDriver),
        'status'  => 'ok',
        'message' => 'Queue driver is configured',
    ];

    // ── Required PHP Extensions ───────────────────────────────────────
    $requiredExtensions = ['pdo', 'pdo_mysql', 'mbstring', 'openssl', 'tokenizer', 'xml', 'ctype', 'json'];
    foreach ($requiredExtensions as $ext) {
        $loaded = extension_loaded($ext);
        $checks[] = [
            'name'    => 'Extension: ' . $ext,
            'value'   => $loaded ? 'Loaded' : 'Missing',
            'status'  => $loaded ? 'ok' : 'error',
            'message' => $loaded ? 'PHP extension is available' : 'Install php-' . $ext . ' extension',
        ];
    }

    $totalChecks  = count($checks);
    $errorCount   = count(array_filter($checks, fn($c) => $c['status'] === 'error'));
    $warningCount = count(array_filter($checks, fn($c) => $c['status'] === 'warning'));
    $okCount      = count(array_filter($checks, fn($c) => $c['status'] === 'ok'));

    $overallStatus = $errorCount > 0 ? 'error' : ($warningCount > 0 ? 'warning' : 'ok');

    return view('welcome', compact(
        'checks', 'totalChecks', 'errorCount', 'warningCount', 'okCount', 'overallStatus',
        'phpVersion', 'env'
    ));
});
