<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->json('final_review_checklist')->nullable();
            $table->text('final_review_notes')->nullable();
            $table->timestamp('ready_for_client_review_at')->nullable();
            $table->unsignedBigInteger('ready_for_client_review_by')->nullable();
            $table->timestamp('client_acknowledged_at')->nullable();
            $table->string('client_acknowledgement_ip', 64)->nullable();
            $table->string('client_acknowledgement_user_agent', 500)->nullable();
            $table->timestamp('client_declaration_signed_at')->nullable();
            $table->text('client_declaration_signature')->nullable();
            $table->timestamp('ready_to_submit_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->date('submission_date')->nullable();
            $table->string('application_number', 128)->nullable();
            $table->string('confirmation_number', 128)->nullable();
            $table->decimal('government_fees', 10, 2)->nullable();
            $table->string('payment_confirmation', 255)->nullable();
            $table->string('receipt_path', 500)->nullable();
            $table->json('submitted_documents_snapshot')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropColumn([
                'final_review_checklist',
                'final_review_notes',
                'ready_for_client_review_at',
                'ready_for_client_review_by',
                'client_acknowledged_at',
                'client_acknowledgement_ip',
                'client_acknowledgement_user_agent',
                'client_declaration_signed_at',
                'client_declaration_signature',
                'ready_to_submit_at',
                'submitted_at',
                'submission_date',
                'application_number',
                'confirmation_number',
                'government_fees',
                'payment_confirmation',
                'receipt_path',
                'submitted_documents_snapshot',
            ]);
        });
    }
};
