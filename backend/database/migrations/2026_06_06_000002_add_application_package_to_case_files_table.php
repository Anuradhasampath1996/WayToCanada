<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('case_files', function (Blueprint $table) {
            $table->foreignId('assigned_ircc_category_id')
                ->nullable()
                ->after('immigration_pathway')
                ->constrained('ircc_categories')
                ->nullOnDelete();
            $table->timestamp('application_package_assigned_at')->nullable()->after('assigned_ircc_category_id');
        });
    }

    public function down(): void
    {
        Schema::table('case_files', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_ircc_category_id');
            $table->dropColumn('application_package_assigned_at');
        });
    }
};
