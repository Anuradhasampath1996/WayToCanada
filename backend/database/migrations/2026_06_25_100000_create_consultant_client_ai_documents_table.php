<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('consultant_client_ai_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->foreignId('consultant_id')->constrained('users')->cascadeOnDelete();
            $table->string('original_filename');
            $table->string('mime_type', 128);
            $table->string('storage_path');
            $table->string('disk', 32)->default('local');
            $table->longText('extracted_text')->nullable();
            $table->unsignedInteger('char_count')->default(0);
            $table->unsignedSmallInteger('page_count')->nullable();
            $table->string('extraction_method', 32)->nullable();
            $table->string('status', 16)->default('ready');
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['client_profile_id', 'consultant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('consultant_client_ai_documents');
    }
};
