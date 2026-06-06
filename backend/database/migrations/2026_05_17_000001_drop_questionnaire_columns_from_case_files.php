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
            $table->dropColumn([
                'questionnaire_token',
                'questionnaire_sent_at',
                'questionnaire_submitted_at',
                'questionnaire_data',
            ]);
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->string('questionnaire_token', 64)->nullable()->unique()->after('immigration_pathway');
            $table->timestamp('questionnaire_sent_at')->nullable()->after('questionnaire_token');
            $table->timestamp('questionnaire_submitted_at')->nullable()->after('questionnaire_sent_at');
            $table->json('questionnaire_data')->nullable()->after('questionnaire_submitted_at');
        });
    }
};
