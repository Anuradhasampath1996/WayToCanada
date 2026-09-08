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
            $table->json('step3_data')->nullable()->after('accompanying_data')
                ->comment('Assessment/eligibility answers (visa refusal, criminal record, CRS inputs)');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('questionnaire_submissions', function (Blueprint $table) {
            $table->dropColumn('step3_data');
        });
    }
};
