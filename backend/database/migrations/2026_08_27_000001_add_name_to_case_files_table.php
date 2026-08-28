<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->string('name', 120)->nullable()->after('case_number');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropColumn('name');
        });
    }
};
