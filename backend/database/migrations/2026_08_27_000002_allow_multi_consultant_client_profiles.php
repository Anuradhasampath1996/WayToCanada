<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('client_profiles', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
        });

        // One practice relationship per consultant+client user.
        Schema::connection('cws')->table('client_profiles', function (Blueprint $table) {
            $table->unique(['user_id', 'consultant_id'], 'client_profiles_user_consultant_unique');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('client_profiles', function (Blueprint $table) {
            $table->dropUnique('client_profiles_user_consultant_unique');
        });

        // Restore single-profile-per-user only if data allows it.
        $dupes = DB::connection('cws')
            ->table('client_profiles')
            ->select('user_id')
            ->groupBy('user_id')
            ->havingRaw('COUNT(*) > 1')
            ->count();

        if ($dupes === 0) {
            Schema::connection('cws')->table('client_profiles', function (Blueprint $table) {
                $table->unique('user_id');
            });
        }
    }
};
