<?php

namespace Database\Seeders;

use App\Services\Referral\ReferralSettingsService;
use Illuminate\Database\Seeder;

class ReferralRewardRuleSeeder extends Seeder
{
    public function run(): void
    {
        app(ReferralSettingsService::class)->ensureDefault();
    }
}
