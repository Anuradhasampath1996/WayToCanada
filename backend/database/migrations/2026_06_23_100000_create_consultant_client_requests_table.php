<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('consultant_client_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('consultant_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 20)->default('pending');
            $table->text('message')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->index(['consultant_id', 'status']);
            $table->index(['client_user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('consultant_client_requests');
    }
};
