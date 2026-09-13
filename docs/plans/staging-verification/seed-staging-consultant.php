<?php

/**
 * Create a synthetic staging consultant. Must load .env.staging only.
 * Never point this at production db_cws.
 */
putenv('APP_ENV=staging');
$_ENV['APP_ENV'] = 'staging';
$_SERVER['APP_ENV'] = 'staging';

require __DIR__.'/../../../backend/vendor/autoload.php';
$app = require __DIR__.'/../../../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$host = (string) config('database.connections.cws.host');
$port = (string) config('database.connections.cws.port');
$database = (string) config('database.connections.cws.database');
if ($port === '5432' || $database === 'db_cws' || ! str_contains($database, 'staging')) {
    fwrite(STDERR, "Refusing to seed: CWS is {$host}:{$port}/{$database}\n");
    exit(1);
}

$consultant = App\Models\User::query()->updateOrCreate(
    ['email' => 'staging.rcic@example.test'],
    [
        'name' => 'Staging RCIC',
        'password' => Illuminate\Support\Facades\Hash::make('StagingSmoke123!'),
        'is_verified' => true,
        'email_verified_at' => now(),
        'rcic_number' => 'R888000001',
        'is_license_verified' => true,
        'license_verified_at' => now(),
        'company_name' => 'Staging Smoke Firm',
    ]
);
$consultant->assignRole('rcic');

echo json_encode([
    'consultant_email' => $consultant->email,
    'database' => $database,
    'port' => $port,
], JSON_PRETTY_PRINT).PHP_EOL;
