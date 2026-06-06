<?php

namespace Database\Seeders;

use App\Models\IrccCategory;
use App\Services\IrccInteractiveFormSyncService;
use Illuminate\Database\Seeder;

class IrccInteractiveFormSeeder extends Seeder
{
    public function run(): void
    {
        $service = new IrccInteractiveFormSyncService();

        IrccCategory::where('level', 3)
            ->orderBy('sort_order')
            ->get()
            ->filter(fn (IrccCategory $p) => IrccInteractiveFormSyncService::isOnlineOnlyPackage($p))
            ->each(fn (IrccCategory $p) => $service->syncPackageForms($p));
    }
}
