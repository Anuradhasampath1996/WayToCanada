<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('pathway_nodes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('parent_code', 64)->nullable()->index();
            $table->string('label');
            $table->string('family', 32)->index();
            $table->string('assessment_branch', 32)->default('skilled');
            $table->json('package_leaf_preferences')->nullable();
            $table->string('province_code', 8)->nullable()->index();
            $table->string('community_code', 64)->nullable();
            $table->string('crs_backend_value')->nullable();
            $table->unsignedInteger('retainer_fee')->nullable();
            $table->text('retainer_description')->nullable();
            $table->boolean('is_assignable')->default(true);
            $table->boolean('is_popular')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('pathway_nodes');
    }
};
