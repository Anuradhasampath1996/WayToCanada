<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('users', function (Blueprint $table) {
            $table->timestamp('rcic_community_last_seen_at')->nullable()->after('updated_at');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('users', function (Blueprint $table) {
            $table->dropColumn('rcic_community_last_seen_at');
        });
    }
};
