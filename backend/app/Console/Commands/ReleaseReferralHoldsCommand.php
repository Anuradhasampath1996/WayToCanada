<?php

namespace App\Console\Commands;

use App\Services\Referral\ReferralHoldReleaseService;
use Illuminate\Console\Command;

class ReleaseReferralHoldsCommand extends Command
{
    protected $signature = 'referral:release-holds';

    protected $description = 'Release referral rewards whose hold period has elapsed';

    public function handle(ReferralHoldReleaseService $holds): int
    {
        $released = $holds->releaseDue();
        $this->info("Released {$released} referral reward(s).");

        return self::SUCCESS;
    }
}
