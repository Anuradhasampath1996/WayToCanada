<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('legislation_catalog', function (Blueprint $table) {
            $table->string('fr_act_code', 40)->nullable()->after('act_code');
            $table->unsignedInteger('documents_synced')->default(0)->after('last_synced_at');
        });
    }

    public function down(): void
    {
        Schema::table('legislation_catalog', function (Blueprint $table) {
            $table->dropColumn(['fr_act_code', 'documents_synced']);
        });
    }
};
