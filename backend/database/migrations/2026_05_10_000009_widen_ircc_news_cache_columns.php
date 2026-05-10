<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ircc_news_cache', function (Blueprint $table) {
            $table->text('guid')->change();   // was string/varchar(255)
            $table->text('title')->change();  // was string/varchar(255)
        });
    }

    public function down(): void
    {
        Schema::table('ircc_news_cache', function (Blueprint $table) {
            $table->string('guid')->change();
            $table->string('title')->change();
        });
    }
};
