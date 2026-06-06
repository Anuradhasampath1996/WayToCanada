<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ircc_interactive_form_responses', function (Blueprint $table) {
            $table->json('verified_fields')->nullable()->after('consultant_notes');
        });
    }

    public function down(): void
    {
        Schema::table('ircc_interactive_form_responses', function (Blueprint $table) {
            $table->dropColumn('verified_fields');
        });
    }
};
