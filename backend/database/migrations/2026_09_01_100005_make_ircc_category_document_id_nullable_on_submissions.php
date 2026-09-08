<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('ircc_package_document_submissions', function (Blueprint $table) {
            $table->unsignedBigInteger('ircc_category_document_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('ircc_package_document_submissions', function (Blueprint $table) {
            $table->unsignedBigInteger('ircc_category_document_id')->nullable(false)->change();
        });
    }
};
