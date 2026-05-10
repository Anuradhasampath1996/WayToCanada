<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ircc_news_cache', function (Blueprint $table) {
            $table->id();
            $table->string('guid')->unique();
            $table->string('title');
            $table->text('link');
            $table->text('description')->nullable();
            $table->string('category')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ircc_news_cache');
    }
};
