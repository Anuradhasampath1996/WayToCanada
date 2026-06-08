<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->text('pathway_assessment_notes')->nullable()->after('immigration_pathway');
            $table->unsignedSmallInteger('pathway_assessment_crs_score')->nullable()->after('pathway_assessment_notes');
            $table->unsignedSmallInteger('pathway_assessment_ircc_crs_score')->nullable()->after('pathway_assessment_crs_score');
            $table->json('pathway_assessment_snapshot')->nullable()->after('pathway_assessment_ircc_crs_score');
            $table->string('pathway_assessment_rules_version', 32)->nullable()->after('pathway_assessment_snapshot');
            $table->timestamp('pathway_assessment_at')->nullable()->after('pathway_assessment_rules_version');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropColumn([
                'pathway_assessment_notes',
                'pathway_assessment_crs_score',
                'pathway_assessment_ircc_crs_score',
                'pathway_assessment_snapshot',
                'pathway_assessment_rules_version',
                'pathway_assessment_at',
            ]);
        });
    }
};
