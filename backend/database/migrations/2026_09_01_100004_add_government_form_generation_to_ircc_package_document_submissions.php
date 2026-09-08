<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('ircc_package_document_submissions', function (Blueprint $table) {
            $table->dropUnique('pkg_doc_submission_unique');
        });

        Schema::connection('cws')->table('ircc_package_document_submissions', function (Blueprint $table) {
            $table->string('generation_type', 32)->default('manual_upload')->after('status');
            $table->foreignId('government_form_version_id')->nullable()->after('generation_type')
                ->constrained('government_form_versions')->nullOnDelete();
            $table->string('mapping_version', 32)->nullable()->after('government_form_version_id');
            $table->string('source_template_hash', 64)->nullable()->after('mapping_version');
            $table->string('source_data_hash', 64)->nullable()->after('source_template_hash');
            $table->string('output_sha256', 64)->nullable()->after('source_data_hash');
            $table->foreignId('generated_by')->nullable()->after('output_sha256')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('generated_at')->nullable()->after('generated_by');
            $table->string('review_status', 32)->nullable()->after('generated_at');
            $table->unsignedBigInteger('supersedes_id')->nullable()->after('review_status');
            $table->string('generation_status', 32)->nullable()->after('supersedes_id');
            $table->string('storage_disk', 32)->default('local')->after('generation_status');

            $table->index(['case_file_id', 'ircc_category_document_id'], 'pkg_doc_submission_case_doc_idx');
            $table->index(['case_file_id', 'generation_status'], 'pkg_doc_submission_gen_status_idx');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('ircc_package_document_submissions', function (Blueprint $table) {
            $table->dropForeign(['government_form_version_id']);
            $table->dropForeign(['generated_by']);
            $table->dropIndex('pkg_doc_submission_case_doc_idx');
            $table->dropIndex('pkg_doc_submission_gen_status_idx');

            $table->dropColumn([
                'generation_type',
                'government_form_version_id',
                'mapping_version',
                'source_template_hash',
                'source_data_hash',
                'output_sha256',
                'generated_by',
                'generated_at',
                'review_status',
                'supersedes_id',
                'generation_status',
                'storage_disk',
            ]);

            $table->unique(['case_file_id', 'ircc_category_document_id'], 'pkg_doc_submission_unique');
        });
    }
};
