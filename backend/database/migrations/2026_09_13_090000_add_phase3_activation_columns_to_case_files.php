<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->string('representative_state', 40)->nullable();
            $table->timestamp('representative_sent_at')->nullable();
            $table->timestamp('representative_signed_at')->nullable();
            $table->timestamp('representative_reviewed_at')->nullable();
            $table->timestamp('representative_completed_at')->nullable();
            $table->timestamp('case_activated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropColumn([
                'representative_state',
                'representative_sent_at',
                'representative_signed_at',
                'representative_reviewed_at',
                'representative_completed_at',
                'case_activated_at',
            ]);
        });
    }
};
