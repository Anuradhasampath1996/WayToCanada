<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "=== LMS Assignments ===\n";
foreach (App\Models\Lms\LmsCourseAssignment::with('course')->get() as $a) {
    echo "assignment={$a->id} client_user_id={$a->client_user_id} course=" . ($a->course?->title ?? '?') . "\n";
}

echo "\n=== Client users ===\n";
foreach (App\Models\User::role('client')->get(['id', 'email']) as $c) {
    echo "id={$c->id} email={$c->email}\n";
}

echo "\n=== Client profiles ===\n";
foreach (App\Models\ClientProfile::all(['id', 'user_id', 'consultant_id']) as $p) {
    echo "profile={$p->id} user_id={$p->user_id} consultant_id={$p->consultant_id}\n";
}
