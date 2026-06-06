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
            $table->json('verified_fields')->nullable()->after('accompanying_data')
                ->comment('Consultant-verified field keys, keyed by dot-path e.g. "main_data.passportNumber"');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('questionnaire_submissions', function (Blueprint $table) {
            $table->dropColumn('verified_fields');
        });
    }
};
