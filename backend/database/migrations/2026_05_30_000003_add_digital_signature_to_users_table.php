<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('users', function (Blueprint $table) {
            $table->text('digital_signature')->nullable()->after('company_country')
                ->comment('Base64 PNG data-URL of the consultant\'s handwritten digital signature');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('users', function (Blueprint $table) {
            $table->dropColumn('digital_signature');
        });
    }
};
