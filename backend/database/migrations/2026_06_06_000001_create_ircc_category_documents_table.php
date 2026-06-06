<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ircc_category_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ircc_category_id')->constrained('ircc_categories')->cascadeOnDelete();
            $table->string('label');
            $table->string('doc_type')->default('other'); // guide | checklist | form | other
            $table->string('file_path');
            $table->string('original_filename');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ircc_category_documents');
    }
};
