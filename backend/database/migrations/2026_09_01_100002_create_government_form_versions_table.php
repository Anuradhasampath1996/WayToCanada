<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('government_form_versions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('ircc_form_catalog_id')->nullable()->index();
            $table->string('form_code', 32)->index();
            $table->string('version_label', 64);
            $table->string('name');
            $table->string('government_authority', 64)->default('IRCC');
            $table->string('official_url', 2048)->nullable();
            $table->string('template_storage_path', 2048)->nullable();
            $table->string('template_sha256', 64)->nullable();
            $table->string('pdf_technology', 32);
            $table->string('submission_mode', 32);
            $table->string('engine_strategy', 64)->default('pdfxfa_append');
            $table->string('mapping_version', 32)->default('1.0.0');
            $table->string('mapping_status', 32)->default('DRAFT');
            $table->string('status', 32)->default('DISABLED');
            $table->string('compatibility_status', 32)->default('REVALIDATION_REQUIRED');
            $table->timestamp('last_verified_at')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('deprecated_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['form_code', 'version_label'], 'gov_form_version_unique');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('government_form_versions');
    }
};
