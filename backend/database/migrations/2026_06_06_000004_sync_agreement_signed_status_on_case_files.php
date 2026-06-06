<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        DB::connection('cws')
            ->table('case_files')
            ->whereNotNull('agreement_signed_at')
            ->whereIn('status', ['PENDING_ASSESSMENT', 'PATHWAY_SELECTED', 'AGREEMENT_SENT'])
            ->update(['status' => 'AGREEMENT_SIGNED']);
    }

    public function down(): void
    {
        // Cannot reliably reverse — signed timestamp may predate status change.
    }
};
