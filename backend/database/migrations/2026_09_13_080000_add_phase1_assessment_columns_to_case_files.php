<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->text('consultation_notes')->nullable();
            $table->text('pathway_selection_reason')->nullable();
            $table->json('pathway_alternatives')->nullable();
            $table->json('pathway_risks')->nullable();
            $table->json('maple_recommendation')->nullable();
            $table->timestamp('maple_recommended_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropColumn([
                'consultation_notes',
                'pathway_selection_reason',
                'pathway_alternatives',
                'pathway_risks',
                'maple_recommendation',
                'maple_recommended_at',
            ]);
        });
    }
};
