<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('tax_rate_versions', function (Blueprint $table) {
            $table->id();
            $table->string('version', 32)->unique();
            $table->unsignedSmallInteger('tax_year');
            $table->date('effective_date');
            $table->json('rates');
            $table->json('source_probes')->nullable();
            $table->string('source_checksum', 64)->nullable();
            $table->boolean('is_active')->default(false);
            $table->boolean('government_pages_changed')->default(false);
            $table->text('changelog')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('tax_rate_versions');
    }
};
