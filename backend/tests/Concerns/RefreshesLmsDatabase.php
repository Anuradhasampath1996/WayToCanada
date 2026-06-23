<?php

namespace Tests\Concerns;

trait RefreshesLmsDatabase
{
    /**
     * RefreshDatabase only runs migrate:fresh on the default (cws) connection.
     * LMS migrations use the separate "lms" connection and must be wiped first.
     */
    protected function wipeLmsTestDatabase(): void
    {
        if (! config('database.connections.lms')) {
            return;
        }

        $this->artisan('db:wipe', [
            '--database' => 'lms',
            '--force' => true,
            '--drop-views' => true,
        ]);
    }
}
