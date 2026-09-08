<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('government_form_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('government_form_version_id')
                ->constrained('government_form_versions')
                ->cascadeOnDelete();
            $table->string('canonical_key', 255);
            $table->string('pdf_field_path', 512);
            $table->string('field_type', 32)->default('text');
            $table->string('transformer', 128)->nullable();
            $table->boolean('is_required')->default(false);
            $table->json('conditional_rule')->nullable();
            $table->string('repeatable_group', 128)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('mapping_version', 32)->default('1.0.0');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['government_form_version_id', 'canonical_key'], 'gov_form_mapping_key_idx');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('government_form_mappings');
    }
};
