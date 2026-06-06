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
            $table->string('company_name')->nullable()->after('rcic_number');
            $table->string('company_logo')->nullable()->after('company_name')
                ->comment('Public URL to the company logo image');
            $table->text('company_bio')->nullable()->after('company_logo')
                ->comment('Short description / tagline for the firm');
            $table->string('company_website')->nullable()->after('company_bio');
            $table->string('company_phone')->nullable()->after('company_website');
            $table->string('company_address_line1')->nullable()->after('company_phone');
            $table->string('company_address_line2')->nullable()->after('company_address_line1');
            $table->string('company_city')->nullable()->after('company_address_line2');
            $table->string('company_province')->nullable()->after('company_city');
            $table->string('company_postal_code')->nullable()->after('company_province');
            $table->string('company_country')->nullable()->default('Canada')->after('company_postal_code');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('users', function (Blueprint $table) {
            $table->dropColumn([
                'company_name', 'company_logo', 'company_bio',
                'company_website', 'company_phone',
                'company_address_line1', 'company_address_line2',
                'company_city', 'company_province',
                'company_postal_code', 'company_country',
            ]);
        });
    }
};
