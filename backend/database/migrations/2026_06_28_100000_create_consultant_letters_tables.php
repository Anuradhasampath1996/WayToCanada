<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('consultant_letter_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('consultant_id');
            $table->string('name', 120);
            $table->string('letter_type', 60)->default('other');
            $table->boolean('applies_to_client')->default(true);
            $table->text('prompt_instructions')->nullable();
            $table->string('subject_template', 500)->nullable();
            $table->longText('body_html')->nullable();
            $table->json('body_json')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['consultant_id', 'letter_type']);
        });

        Schema::connection('cws')->create('consultant_letters', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('consultant_id');
            $table->unsignedBigInteger('client_profile_id')->nullable();
            $table->unsignedBigInteger('template_id')->nullable();
            $table->string('title', 200);
            $table->string('letter_type', 60)->default('other');
            $table->string('status', 20)->default('draft');
            $table->string('subject', 500)->nullable();
            $table->longText('body_html')->nullable();
            $table->json('body_json')->nullable();
            $table->string('generation_mode', 20)->default('blank');
            $table->text('generation_prompt')->nullable();
            $table->json('context_snapshot')->nullable();
            $table->boolean('openai_used')->default(false);
            $table->string('exported_pdf_path', 500)->nullable();
            $table->timestamps();

            $table->index(['consultant_id', 'status']);
            $table->index(['consultant_id', 'client_profile_id']);
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('consultant_letters');
        Schema::connection('cws')->dropIfExists('consultant_letter_templates');
    }
};
