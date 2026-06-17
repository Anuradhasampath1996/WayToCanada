<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consultant_website_feature_sections', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('tag', 80)->nullable();
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->text('description');
            $table->json('bullet_points')->nullable();
            $table->string('icon', 60)->default('Sparkles');
            $table->string('media_type', 20)->default('mock'); // mock|image|gif|video
            $table->string('media_url')->nullable();
            $table->string('mock_variant', 60)->nullable();
            $table->string('media_alt')->nullable();
            $table->string('layout', 10)->default('right'); // media on right; alternate left
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consultant_website_feature_sections');
    }
};
