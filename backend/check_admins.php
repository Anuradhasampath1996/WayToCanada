<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->boot();

use Illuminate\Support\Facades\DB;

$rows = DB::connection('cws')
    ->table('users')
    ->join('model_has_roles','users.id','=','model_has_roles.model_id')
    ->join('roles','model_has_roles.role_id','=','roles.id')
    ->whereIn('roles.name',['super-admin','admin'])
    ->select('users.id','users.name','users.email','roles.name as role')
    ->get();

echo json_encode($rows, JSON_PRETTY_PRINT) . "\n";

// Also count valid tokens
$tokenCount = DB::connection('cws')->table('personal_access_tokens')
    ->whereNull('expires_at')
    ->orWhere('expires_at', '>', now())
    ->count();
echo "Active tokens: $tokenCount\n";
