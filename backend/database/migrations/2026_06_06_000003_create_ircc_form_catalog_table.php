<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ircc_form_catalog', function (Blueprint $table) {
            $table->id();
            $table->string('form_code');           // e.g. IMM 5257
            $table->string('normalized_code');     // e.g. imm5257
            $table->string('title');
            $table->string('page_url');
            $table->string('page_slug');           // e.g. imm5257
            $table->string('date_modified', 20)->nullable(); // e.g. 2026-05
            $table->string('pdf_url')->nullable();
            $table->string('pdf_filename')->nullable();
            $table->timestamp('last_fetched_at')->nullable();
            $table->timestamps();

            $table->unique('normalized_code');
            $table->index('form_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ircc_form_catalog');
    }
};
