<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('questionnaire_submissions', function (Blueprint $table) {
            $table->json('field_remarks')->nullable()->after('verified_fields')
                ->comment('Consultant refill requests keyed by dot-path e.g. "main_data.passportNumber"');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('questionnaire_submissions', function (Blueprint $table) {
            $table->dropColumn('field_remarks');
        });
    }
};
