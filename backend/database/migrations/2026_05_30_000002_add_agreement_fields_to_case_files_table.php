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
            $table->decimal('agreement_fee', 10, 2)->nullable()->after('agreement_signed_at');
            $table->text('agreement_notes')->nullable()->after('agreement_fee');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropColumn(['agreement_fee', 'agreement_notes']);
        });
    }
};
