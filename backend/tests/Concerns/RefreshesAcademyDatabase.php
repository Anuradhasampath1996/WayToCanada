<?php

namespace Tests\Concerns;

use App\Services\Academy\AcademyBootstrap;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

trait RefreshesAcademyDatabase
{
    /**
     * LMS migrations run during RefreshDatabase but write to a separate connection.
     * Wipe leftover db_lms_test tables before migrate:fresh. Never wipe product db_lms.
     */
    protected function wipeLmsTestDatabaseIfSafe(): void
    {
        if (config('database.connections.lms.database') !== 'db_lms_test') {
            return;
        }

        Schema::connection('lms')->dropAllTables();
    }

    /**
     * migrate:fresh only drops the default CWS connection. Academy tables live on
     * db_academy and would otherwise collide when the Academy migration re-runs.
     */
    protected function wipeAcademyTestDatabaseIfSafe(): void
    {
        if (config('database.connections.academy.database') !== 'db_academy_test') {
            return;
        }

        Schema::connection('academy')->dropAllTables();
    }

    /**
     * Reset only db_academy_test. Never wipe db_cws, db_lms, or a non-test academy database.
     */
    protected function resetAcademySchema(): void
    {
        $database = (string) config('database.connections.academy.database');
        if ($database !== 'db_academy_test') {
            throw new \RuntimeException('Refusing to wipe Academy database ['.$database.']. Tests may only reset db_academy_test.');
        }

        $schema = Schema::connection('academy');

        if (! $schema->hasTable('academy_learning_tracks')) {
            $migration = include database_path('migrations/2026_09_14_140000_create_academy_tables.php');
            $migration->up();

            return;
        }

        $names = collect($schema->getTables())
            ->map(fn ($table) => is_array($table) ? ($table['name'] ?? '') : (string) $table)
            ->filter()
            ->unique()
            ->values();

        if ($names->isNotEmpty()) {
            $quoted = $names
                ->map(fn (string $name) => '"'.str_replace('"', '""', $name).'"')
                ->implode(', ');
            DB::connection('academy')->statement('TRUNCATE TABLE '.$quoted.' RESTART IDENTITY CASCADE');
        }

        app(AcademyBootstrap::class)->ensure();
    }
}
