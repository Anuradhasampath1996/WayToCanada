<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $consultantIds = DB::connection('cws')
            ->table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('roles.name', 'rcic')
            ->where('model_has_roles.model_type', 'App\\Models\\User')
            ->pluck('model_has_roles.model_id');

        if ($consultantIds->isEmpty()) {
            return;
        }

        $now = now();

        foreach ($consultantIds->chunk(100) as $chunk) {
            $users = DB::connection('cws')
                ->table('users')
                ->whereIn('id', $chunk->all())
                ->get(['id', 'phone', 'company_phone']);

            foreach ($users as $user) {
                $phone = $user->phone ?: $user->company_phone;

                $existing = DB::connection('cws')
                    ->table('user_notification_preferences')
                    ->where('user_id', $user->id)
                    ->first();

                if ($existing) {
                    $updates = [
                        'whatsapp_enabled' => true,
                        'updated_at'       => $now,
                    ];

                    if (! $existing->whatsapp_phone && $phone) {
                        $updates['whatsapp_phone'] = $phone;
                    }

                    DB::connection('cws')
                        ->table('user_notification_preferences')
                        ->where('id', $existing->id)
                        ->update($updates);

                    continue;
                }

                DB::connection('cws')->table('user_notification_preferences')->insert([
                    'user_id'            => $user->id,
                    'in_app_enabled'     => true,
                    'email_enabled'      => true,
                    'whatsapp_enabled'   => true,
                    'whatsapp_phone'     => $phone,
                    'whatsapp_verified'  => false,
                    'category_preferences'=> null,
                    'created_at'         => $now,
                    'updated_at'         => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        // Non-destructive preference change; leave consultant WhatsApp settings as-is.
    }
};
