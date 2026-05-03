<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Widens columns that can hold arbitrary-length data in the CICC CSV export.
 * languages, website, profile_url, address_line_1, address_line_2 are changed
 * from varchar(255) to text so large values don't cause SQLSTATE[22001] errors.
 */
return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('rcic_consultants', function (Blueprint $table) {
            $table->text('languages')->nullable()->change();
            $table->text('website')->nullable()->change();
            $table->text('profile_url')->nullable()->change();
            $table->text('address_line_1')->nullable()->change();
            $table->text('address_line_2')->nullable()->change();
            $table->text('company')->nullable()->change();
            $table->text('email')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('rcic_consultants', function (Blueprint $table) {
            $table->string('languages')->nullable()->change();
            $table->string('website')->nullable()->change();
            $table->string('profile_url')->nullable()->change();
            $table->string('address_line_1')->nullable()->change();
            $table->string('address_line_2')->nullable()->change();
            $table->string('company')->nullable()->change();
            $table->string('email')->nullable()->change();
        });
    }
};
