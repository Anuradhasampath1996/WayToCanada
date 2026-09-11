<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection('cws');

        if (! $schema->hasColumn('platform_company_settings', 'ontario_corporation_number')) {
            $schema->table('platform_company_settings', function (Blueprint $table) {
                $table->string('ontario_corporation_number', 32)->nullable();
            });
        }

        // Widen GST/HST so notes like "(Pending RT Activation)" fit.
        DB::connection('cws')->statement(
            'ALTER TABLE platform_company_settings ALTER COLUMN gst_hst_number TYPE VARCHAR(128)'
        );

        $payload = [
            'legal_name'                 => 'Widget Pixels Inc.',
            'trade_name'                 => 'RCICMASTER',
            'business_number'            => '705701035',
            'gst_hst_number'             => '705701035 RT0001 (Pending RT Activation)',
            'ontario_corporation_number' => '1001651150',
            'address_line1'              => '145 Church Street, Unit 5',
            'address_line2'              => null,
            'city'                       => 'Toronto',
            'province'                   => 'ON',
            'postal_code'                => 'M5B 1Y4',
            'country'                    => 'CA',
            'support_email'              => 'support@widgetpixels.com',
            'billing_email'              => 'support@widgetpixels.com',
            'updated_at'                 => now(),
        ];

        $id = DB::connection('cws')->table('platform_company_settings')->orderBy('id')->value('id');
        if ($id) {
            DB::connection('cws')->table('platform_company_settings')->where('id', $id)->update($payload);
        } else {
            DB::connection('cws')->table('platform_company_settings')->insert(array_merge($payload, [
                'website'        => 'https://www.rcicmaster.ca',
                'invoice_prefix' => 'RCM',
                'invoice_footer' => 'Thank you for your business. This tax invoice is issued in accordance with CRA requirements for Canadian sales tax.',
                'created_at'     => now(),
            ]));
        }
    }

    public function down(): void
    {
        $schema = Schema::connection('cws');

        if ($schema->hasColumn('platform_company_settings', 'ontario_corporation_number')) {
            $schema->table('platform_company_settings', function (Blueprint $table) {
                $table->dropColumn('ontario_corporation_number');
            });
        }

        DB::connection('cws')->statement(
            'ALTER TABLE platform_company_settings ALTER COLUMN gst_hst_number TYPE VARCHAR(32)'
        );
    }
};
