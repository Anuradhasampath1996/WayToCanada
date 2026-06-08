<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('crs_rule_versions', function (Blueprint $table) {
            $table->id();
            $table->string('version', 32)->unique();
            $table->date('effective_date');
            $table->json('rules');
            $table->string('source_url')->nullable();
            $table->string('source_checksum', 64)->nullable();
            $table->boolean('is_active')->default(false);
            $table->text('changelog')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('crs_rule_versions');
    }
};
