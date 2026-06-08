<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('consultant_agreement_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('consultant_id');
            $table->string('name', 120);
            $table->string('pathway', 150)->nullable();
            $table->json('config');
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['consultant_id', 'pathway']);
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('consultant_agreement_templates');
    }
};
