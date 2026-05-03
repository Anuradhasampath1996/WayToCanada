<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the rcic_consultants table in db_cws.
 *
 * This table mirrors the official CICC public register and is used to:
 *  - Verify RCIC registrations (college_id lookup during onboarding)
 *  - Display consultant profiles in the Marketplace
 *  - Determine entitled_to_practise status
 *
 * Data source: rcic_export.csv (manually uploaded by admin, see RcicConsultantsSeeder)
 */
return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('rcic_consultants', function (Blueprint $table) {
            // ── Identifiers ───────────────────────────────────────────────
            $table->id();
            $table->unsignedInteger('profile_id')->unique()->comment('CICC public register profile ID');
            $table->string('college_id', 20)->nullable()->index()->comment('Issued RCIC college ID e.g. R711248');

            // ── Name ─────────────────────────────────────────────────────
            $table->string('full_name')->nullable();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();

            // ── Classification ───────────────────────────────────────────
            $table->string('type', 50)->nullable()->comment('RCIC, RISIA, etc.');
            $table->string('status', 50)->nullable()->index()->comment('Active, Suspended, Leave of Absence, etc.');

            // ── Contact / Business ───────────────────────────────────────
            $table->string('company')->nullable();
            $table->string('address_line_1')->nullable();
            $table->string('address_line_2')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('province', 100)->nullable();
            $table->string('country', 100)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('fax', 50)->nullable();
            $table->string('email')->nullable();
            $table->string('website')->nullable();
            $table->string('languages')->nullable();

            // ── Practise Flag ─────────────────────────────────────────────
            $table->boolean('entitled_to_practise')->default(false)->index();

            // ── Scrape Metadata ───────────────────────────────────────────
            $table->string('scrape_status', 30)->nullable()->comment('scraped, error, pending');
            $table->timestamp('scraped_at')->nullable();
            $table->string('profile_url')->nullable();

            // ── Rich History (pipe-delimited from CICC) ───────────────────
            $table->text('licence_history')->nullable()->comment('Class|Start|Expiry|Status § ...');
            $table->text('suspension_revocation')->nullable()->comment('Status|Reason|Start|End § ...');
            $table->text('employment')->nullable()->comment('Company|Start|City|Province|Country|Email|Phone § ...');
            $table->text('agents')->nullable()->comment('Name|Company|City|Province|Country|Email|Phone § ...');

            $table->timestamps();

            // ── Indexes for verification lookups ──────────────────────────
            $table->index(['college_id', 'entitled_to_practise'], 'idx_college_practise');
            $table->index(['last_name', 'first_name'], 'idx_name_search');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('rcic_consultants');
    }
};
