<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ircc_category_documents', function (Blueprint $table) {
            $table->string('source_form_code')->nullable()->after('doc_type');
            $table->string('source_url')->nullable()->after('source_form_code');
            $table->string('source_date_modified', 20)->nullable()->after('source_url');
            $table->timestamp('last_synced_at')->nullable()->after('source_date_modified');
            $table->boolean('auto_synced')->default(false)->after('last_synced_at');
        });
    }

    public function down(): void
    {
        Schema::table('ircc_category_documents', function (Blueprint $table) {
            $table->dropColumn([
                'source_form_code',
                'source_url',
                'source_date_modified',
                'last_synced_at',
                'auto_synced',
            ]);
        });
    }
};
