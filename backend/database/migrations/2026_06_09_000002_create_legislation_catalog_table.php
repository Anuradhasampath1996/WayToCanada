<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legislation_catalog', function (Blueprint $table) {
            $table->id();
            $table->string('act_code', 40)->unique();
            $table->string('title');
            $table->string('category', 20)->default('act');
            $table->boolean('is_active')->default(true);
            $table->timestamp('discovered_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legislation_catalog');
    }
};
