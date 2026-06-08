<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('ircc_package_document_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_file_id')->constrained('case_files')->cascadeOnDelete();
            $table->unsignedBigInteger('ircc_category_document_id');
            $table->foreignId('uploaded_by')->constrained('users')->cascadeOnDelete();
            $table->string('file_path');
            $table->string('original_filename');
            $table->string('mime_type')->default('application/pdf');
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('status')->default('submitted');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->unique(['case_file_id', 'ircc_category_document_id'], 'pkg_doc_submission_unique');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('ircc_package_document_submissions');
    }
};
