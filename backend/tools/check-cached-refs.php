<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

App\Models\LegislationReference::where('document_id', 1)
    ->where(function ($q) {
        $q->where('label', 'like', '%(1)%')
            ->orWhere('label', 'like', '%1.01%')
            ->orWhere('label', 'like', '%subsections%');
    })
    ->get(['label', 'target_provision_key'])
    ->each(fn ($r) => print("{$r->label} => {$r->target_provision_key}\n"));
