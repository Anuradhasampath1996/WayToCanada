<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Schema;

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
        $this->wipeSatelliteTestDatabases();
    }

    protected function wipeSatelliteTestDatabases(): void
    {
        if (config('database.connections.lms.database') === 'db_lms_test') {
            Schema::connection('lms')->dropAllTables();
        }

        if (config('database.connections.academy.database') === 'db_academy_test') {
            Schema::connection('academy')->dropAllTables();
        }
    }
}
