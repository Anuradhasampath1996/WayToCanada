<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->text('client_signature')->nullable()->after('agreement_signed_at');
            $table->string('signed_document_path', 500)->nullable()->after('client_signature');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropColumn(['client_signature', 'signed_document_path']);
        });
    }
};
