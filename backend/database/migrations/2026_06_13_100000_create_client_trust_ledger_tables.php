<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('client_trust_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_file_id')->unique()->constrained('case_files')->cascadeOnDelete();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->foreignId('consultant_id')->constrained('users')->cascadeOnDelete();
            $table->string('currency', 3)->default('CAD');
            $table->decimal('total_deposited', 12, 2)->default(0);
            $table->decimal('total_released', 12, 2)->default(0);
            $table->decimal('total_refunded', 12, 2)->default(0);
            $table->decimal('balance_held', 12, 2)->default(0);
            $table->string('status', 32)->default('active'); // active, closed
            $table->timestamp('opened_at')->nullable();
            $table->timestamps();

            $table->index(['client_profile_id', 'status']);
        });

        Schema::connection('cws')->create('case_fee_milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_file_id')->constrained('case_files')->cascadeOnDelete();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->string('milestone_key', 8); // 1, 2, 3
            $table->string('label');
            $table->unsignedTinyInteger('percentage');
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3)->default('CAD');
            $table->string('status', 32)->default('pending');
            // pending, in_progress, completed, invoiced, released
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedTinyInteger('sort_order')->default(1);
            $table->timestamps();

            $table->unique(['case_file_id', 'milestone_key']);
        });

        Schema::connection('cws')->create('milestone_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_fee_milestone_id')->constrained('case_fee_milestones')->cascadeOnDelete();
            $table->foreignId('client_trust_account_id')->constrained('client_trust_accounts')->cascadeOnDelete();
            $table->foreignId('case_file_id')->constrained('case_files')->cascadeOnDelete();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->foreignId('consultant_id')->constrained('users')->cascadeOnDelete();
            $table->string('invoice_number', 64)->unique();
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3)->default('CAD');
            $table->string('status', 32)->default('pending_client_approval');
            // pending_client_approval, approved, released, cancelled
            $table->text('consultant_notes')->nullable();
            $table->timestamp('client_approved_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->foreignId('released_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('ledger_release_entry_id')->nullable();
            $table->timestamps();

            $table->index(['client_profile_id', 'status']);
        });

        Schema::connection('cws')->create('trust_ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_trust_account_id')->constrained('client_trust_accounts')->cascadeOnDelete();
            $table->foreignId('case_file_id')->constrained('case_files')->cascadeOnDelete();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->string('entry_type', 32);
            // trust_deposit, trust_release, trust_refund, adjustment
            $table->string('direction', 8); // credit, debit
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3)->default('CAD');
            $table->decimal('balance_after', 12, 2);
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('reference_type', 64)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->foreignId('case_fee_milestone_id')->nullable()->constrained('case_fee_milestones')->nullOnDelete();
            $table->foreignId('milestone_invoice_id')->nullable()->constrained('milestone_invoices')->nullOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_type', 32)->default('system');
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['client_trust_account_id', 'occurred_at']);
            $table->index(['client_profile_id', 'entry_type']);
        });

        Schema::connection('cws')->table('client_payment_requests', function (Blueprint $table) {
            $table->string('payment_purpose', 32)->default('general')->after('provider');
            // general, trust_deposit
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('client_payment_requests', function (Blueprint $table) {
            $table->dropColumn('payment_purpose');
        });
        Schema::connection('cws')->dropIfExists('trust_ledger_entries');
        Schema::connection('cws')->dropIfExists('milestone_invoices');
        Schema::connection('cws')->dropIfExists('case_fee_milestones');
        Schema::connection('cws')->dropIfExists('client_trust_accounts');
    }
};
