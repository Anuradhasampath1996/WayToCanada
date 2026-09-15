<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::connection('lms')->hasTable('lms_courses')) {
            return;
        }

        Schema::connection('lms')->table('lms_courses', function (Blueprint $table) {
            if (! Schema::connection('lms')->hasColumn('lms_courses', 'audience')) {
                $table->string('audience', 32)->default('client')->after('access_mode')->index();
            }
        });

        // AI Course Factory drafts/published exam courses are consultant-facing.
        DB::connection('lms')->table('lms_courses')
            ->whereNotNull('cf_generation_run_id')
            ->update(['audience' => 'consultant']);
    }

    public function down(): void
    {
        if (! Schema::connection('lms')->hasTable('lms_courses')) {
            return;
        }

        Schema::connection('lms')->table('lms_courses', function (Blueprint $table) {
            if (Schema::connection('lms')->hasColumn('lms_courses', 'audience')) {
                $table->dropColumn('audience');
            }
        });
    }
};
