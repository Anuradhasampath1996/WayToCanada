<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legislation_sync_runs', function (Blueprint $table) {
            $table->id();
            $table->string('status', 20)->default('pending'); // pending|running|completed|failed
            $table->string('scope', 40)->default('all'); // all|source|document
            $table->string('source_slug')->nullable();
            $table->unsignedInteger('total_steps')->default(0);
            $table->unsignedInteger('completed_steps')->default(0);
            $table->string('current_step')->nullable();
            $table->json('stats')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        Schema::create('legislation_documents', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('source_slug', 80);
            $table->string('act_code', 40)->nullable();
            $table->string('title');
            $table->string('language', 5); // en|fr
            $table->string('format', 10); // xml|html|pdf
            $table->string('category', 20)->default('act'); // act|regulation|guide
            $table->string('source_url');
            $table->string('storage_path')->nullable();
            $table->string('content_hash', 64)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->longText('rendered_html')->nullable();
            $table->unsignedInteger('provisions_count')->default(0);
            $table->boolean('ai_analyzed')->default(false);
            $table->timestamp('last_synced_at')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedBigInteger('paired_document_id')->nullable();
            $table->timestamps();

            $table->unique(['source_slug', 'language', 'format']);
            $table->index(['act_code', 'language']);
        });

        Schema::create('legislation_provisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('legislation_documents')->cascadeOnDelete();
            $table->string('act_code', 40);
            $table->string('language', 5);
            $table->string('provision_key', 80);
            $table->string('section_label', 20)->nullable();
            $table->string('subsection_label', 20)->nullable();
            $table->string('paragraph_label', 20)->nullable();
            $table->string('marginal_note')->nullable();
            $table->text('text_content');
            $table->text('html_fragment');
            $table->string('lims_fid', 40)->nullable();
            $table->timestamps();

            $table->unique(['act_code', 'language', 'provision_key']);
            $table->index(['document_id', 'provision_key']);
        });

        Schema::create('legislation_references', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('legislation_documents')->cascadeOnDelete();
            $table->string('source_text', 500)->nullable();
            $table->unsignedInteger('char_start')->nullable();
            $table->unsignedInteger('char_end')->nullable();
            $table->string('target_act_code', 40)->nullable();
            $table->string('target_provision_key', 80)->nullable();
            $table->string('label', 200);
            $table->enum('source_type', ['auto_xml', 'auto_ai', 'manual'])->default('auto_xml');
            $table->boolean('is_external')->default(false);
            $table->text('custom_popup_html')->nullable();
            $table->text('admin_notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['document_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legislation_references');
        Schema::dropIfExists('legislation_provisions');
        Schema::dropIfExists('legislation_documents');
        Schema::dropIfExists('legislation_sync_runs');
    }
};
