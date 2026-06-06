<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('client_profiles', function (Blueprint $table) {
            $table->timestamp('notes_updated_at')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('client_profiles', function (Blueprint $table) {
            $table->dropColumn('notes_updated_at');
        });
    }
};
