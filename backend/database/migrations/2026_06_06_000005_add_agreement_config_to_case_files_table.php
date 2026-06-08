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
            $table->json('agreement_config')->nullable()->after('agreement_notes');
            $table->unsignedSmallInteger('agreement_version')->default(1)->after('agreement_config');
            $table->json('agreement_milestone_payments')->nullable()->after('agreement_version');
            $table->string('agreement_signed_ip', 45)->nullable()->after('client_signature');
            $table->string('agreement_signed_user_agent', 500)->nullable()->after('agreement_signed_ip');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropColumn([
                'agreement_config',
                'agreement_version',
                'agreement_milestone_payments',
                'agreement_signed_ip',
                'agreement_signed_user_agent',
            ]);
        });
    }
};
