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
            $table->timestamp('agreement_last_reminder_at')->nullable()->after('agreement_sent_at');
            $table->unsignedSmallInteger('agreement_reminder_count')->default(0)->after('agreement_last_reminder_at');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropColumn(['agreement_last_reminder_at', 'agreement_reminder_count']);
        });
    }
};
