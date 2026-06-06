<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ircc_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')
                  ->nullable()
                  ->constrained('ircc_categories')
                  ->nullOnDelete();
            $table->unsignedTinyInteger('level');   // 1 = root, 2 = sub-category, 3 = leaf
            $table->string('label');
            $table->json('result')->nullable();     // only level-3 rows carry this
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ircc_categories');
    }
};
