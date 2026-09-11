<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            if (! Schema::connection('cws')->hasColumn('case_files', 'pathway_code')) {
                $table->string('pathway_code', 64)->nullable()->after('immigration_pathway')->index();
            }
        });

        Schema::connection('cws')->table('client_profiles', function (Blueprint $table) {
            if (! Schema::connection('cws')->hasColumn('client_profiles', 'pathway_code')) {
                $table->string('pathway_code', 64)->nullable()->after('immigration_pathway')->index();
            }
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            if (Schema::connection('cws')->hasColumn('case_files', 'pathway_code')) {
                $table->dropColumn('pathway_code');
            }
        });

        Schema::connection('cws')->table('client_profiles', function (Blueprint $table) {
            if (Schema::connection('cws')->hasColumn('client_profiles', 'pathway_code')) {
                $table->dropColumn('pathway_code');
            }
        });
    }
};
