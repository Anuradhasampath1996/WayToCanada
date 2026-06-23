<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legislation_amendment_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('legislation_documents')->cascadeOnDelete();
            $table->string('act_code', 40);
            $table->string('language', 5);
            $table->string('format', 10);
            $table->string('previous_hash', 64)->nullable();
            $table->string('new_hash', 64);
            $table->timestamp('detected_at');
            $table->timestamp('acknowledged_at')->nullable();
            $table->unsignedBigInteger('acknowledged_by')->nullable();
            $table->timestamps();

            $table->index(['act_code', 'detected_at']);
            $table->index(['acknowledged_at', 'detected_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legislation_amendment_alerts');
    }
};
