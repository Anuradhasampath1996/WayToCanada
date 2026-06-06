<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->timestamp('application_forms_verified_at')->nullable()->after('agreement_signed_at');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropColumn('application_forms_verified_at');
        });
    }
};
