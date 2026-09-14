<?php

namespace Tests\Concerns;

use Illuminate\Support\Facades\Schema;

trait RefreshesLmsDatabase
{
    /**
     * RefreshDatabase only runs migrate:fresh on the default (cws) connection.
     * LMS migrations use the separate "lms" connection and must be wiped first.
     */
    protected function wipeLmsTestDatabase(): void
    {
        if (config('database.connections.lms.database') !== 'db_lms_test') {
            return;
        }

        Schema::connection('lms')->dropAllTables();
    }

    protected function ensureLmsTestSchema(): void
    {
        if (config('database.connections.lms.database') !== 'db_lms_test') {
            return;
        }
        if (! Schema::connection('lms')->hasTable('lms_categories')) {
            $base = include database_path('migrations/2026_06_11_200000_create_lms_tables.php');
            $base->up();
        }
        if (! Schema::connection('lms')->hasTable('lms_question_bank')) {
            $adv = include database_path('migrations/2026_06_11_210000_lms_advanced_features.php');
            $adv->up();
        }
        if (! Schema::connection('lms')->hasTable('lms_exam_templates')) {
            $marketplace = include database_path('migrations/2026_09_14_181000_create_learning_marketplace_lms_tables.php');
            $marketplace->up();
        }
        if (! Schema::connection('lms')->hasTable('lms_ai_generation_steps')) {
            $ai = include database_path('migrations/2026_09_14_190000_create_lms_ai_satellite_tables.php');
            $ai->up();
        }
        $this->truncateSatelliteIfExists('lms', 'db_lms_test');
    }
}
