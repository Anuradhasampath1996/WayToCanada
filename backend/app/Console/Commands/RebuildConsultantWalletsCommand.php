<?php

namespace App\Console\Commands;

use App\Models\ConsultantWallet;
use App\Services\Referral\ConsultantWalletLedgerService;
use Illuminate\Console\Command;

class RebuildConsultantWalletsCommand extends Command
{
    protected $signature = 'referral:rebuild-wallets';

    protected $description = 'Recompute cached consultant wallet totals from the ledger';

    public function handle(ConsultantWalletLedgerService $ledger): int
    {
        $count = 0;
        ConsultantWallet::query()->orderBy('id')->each(function (ConsultantWallet $wallet) use ($ledger, &$count) {
            $ledger->recompute($wallet);
            $count++;
        });
        $this->info("Recomputed {$count} wallet(s).");

        return self::SUCCESS;
    }
}
