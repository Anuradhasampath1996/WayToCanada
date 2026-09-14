<?php

namespace Tests;

use App\Contracts\StripePlatformClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Fakes\FakeStripePlatformClient;

abstract class TestCase extends BaseTestCase
{
    /**
     * RefreshDatabase only drops the default CWS connection. Satellite test
     * databases must be cleared before those migrations re-run.
     * Never wipe product db_lms / db_academy.
     */
    public function refreshApplication()
    {
        parent::refreshApplication();

        if (! in_array(RefreshDatabase::class, class_uses_recursive(static::class), true)) {
            return;
        }

        // Drop satellites only before the first migrate:fresh in this process.
        // Dropping db_lms_test / db_academy_test on every test forced full DDL
        // rebuilds against Docker Postgres and produced a no-output "hang"
        // (PHPUnit buffers until the process ends; the run was killed ~11 min).
        if (! RefreshDatabaseState::$migrated) {
            $this->wipeSatelliteTestDatabases();

            return;
        }

        $this->truncateSatelliteIfExists('lms', 'db_lms_test');
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->app->instance(StripePlatformClient::class, new FakeStripePlatformClient());
        config([
            'academy_ai.research_driver' => 'fake',
            'academy_ai.generation_driver' => 'fake',
            'academy_ai.manus.enabled' => false,
            'academy_ai.manus.api_key' => null,
            'academy_ai.manus.poll_seconds' => 0,
            'academy_ai.manus.timeout_seconds' => 0,
            'academy_ai.openai.key' => '',
        ]);
    }

    protected function wipeSatelliteTestDatabases(): void
    {
        if (config('database.connections.lms.database') === 'db_lms_test') {
            $this->dropSatelliteTables('lms', 'db_lms_test');
        }

        if (config('database.connections.academy.database') === 'db_academy_test') {
            $this->dropSatelliteTables('academy', 'db_academy_test');
        }
    }

    /**
     * Drop satellite tables on the test database only. Terminate leftover
     * backends first so a killed PHPUnit cannot hold AccessExclusiveLock and
     * deadlock dropAllTables (Windows/Docker).
     */
    protected function dropSatelliteTables(string $connection, string $expectedDatabase): void
    {
        if (config("database.connections.{$connection}.database") !== $expectedDatabase) {
            return;
        }

        $this->terminateOtherBackendsOnTestDatabase($connection, $expectedDatabase);

        for ($attempt = 1; $attempt <= 3; $attempt++) {
            try {
                Schema::connection($connection)->dropAllTables();

                return;
            } catch (\Throwable $e) {
                if ($attempt === 3 || ! str_contains($e->getMessage(), 'deadlock')) {
                    throw $e;
                }
                usleep(250_000);
                $this->terminateOtherBackendsOnTestDatabase($connection, $expectedDatabase);
            }
        }
    }

    protected function terminateOtherBackendsOnTestDatabase(string $connection, string $expectedDatabase): void
    {
        if (config("database.connections.{$connection}.database") !== $expectedDatabase) {
            return;
        }

        try {
            $rows = DB::connection($connection)->select(
                'SELECT pid FROM pg_stat_activity WHERE datname = ? AND pid <> pg_backend_pid()',
                [$expectedDatabase]
            );
            foreach ($rows as $row) {
                DB::connection($connection)->select('SELECT pg_terminate_backend(?)', [(int) $row->pid]);
            }
        } catch (\Throwable) {
            // The test database may not exist yet, or the session may already be gone.
        }

        DB::connection($connection)->disconnect();
    }

    /**
     * Fast isolation for satellite DBs that already have a schema. Never truncates
     * a non-test database name.
     */
    protected function truncateSatelliteIfExists(string $connection, string $expectedDatabase): void
    {
        $database = (string) config("database.connections.{$connection}.database");
        if ($database !== $expectedDatabase) {
            return;
        }

        try {
            $tables = Schema::connection($connection)->getTableListing(null, false);
        } catch (\Throwable) {
            return;
        }

        $tables = array_values(array_filter(
            $tables,
            fn ($table) => is_string($table)
                && $table !== ''
                && $table !== 'migrations'
                && $table !== 'spatial_ref_sys'
        ));
        if ($tables === []) {
            return;
        }

        $quoted = collect($tables)
            ->map(fn (string $table) => '"'.str_replace('"', '""', $table).'"')
            ->implode(', ');
        DB::connection($connection)->statement("TRUNCATE {$quoted} RESTART IDENTITY CASCADE");
    }
}
