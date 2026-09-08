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
            $table->timestamp('application_info_reviewed_at')->nullable()->after('application_forms_verified_at');
            $table->foreignId('application_info_reviewed_by')->nullable()->after('application_info_reviewed_at')
                ->constrained('users')->nullOnDelete();
            $table->json('questionnaire_snapshot')->nullable()->after('application_info_reviewed_by');
            $table->string('questionnaire_snapshot_hash', 64)->nullable()->after('questionnaire_snapshot');
            $table->timestamp('questionnaire_snapshot_at')->nullable()->after('questionnaire_snapshot_hash');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropForeign(['application_info_reviewed_by']);
            $table->dropColumn([
                'application_info_reviewed_at',
                'application_info_reviewed_by',
                'questionnaire_snapshot',
                'questionnaire_snapshot_hash',
                'questionnaire_snapshot_at',
            ]);
        });
    }
};
