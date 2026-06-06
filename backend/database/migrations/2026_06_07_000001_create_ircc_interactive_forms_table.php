<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ircc_interactive_forms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ircc_category_id')
                ->constrained('ircc_categories')
                ->cascadeOnDelete();
            $table->string('slug', 100);
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('form_schema');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['ircc_category_id', 'slug']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ircc_interactive_forms');
    }
};
