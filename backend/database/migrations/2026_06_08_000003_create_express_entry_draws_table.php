<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('express_entry_draws', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('draw_number')->unique();
            $table->date('draw_date');
            $table->string('draw_name')->nullable();
            $table->unsignedSmallInteger('minimum_crs_score')->nullable();
            $table->unsignedInteger('invitations_issued')->nullable();
            $table->string('round_type')->nullable();
            $table->json('raw_data')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('express_entry_draws');
    }
};
