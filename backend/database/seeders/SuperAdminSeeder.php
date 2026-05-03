<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('SUPER_ADMIN_EMAIL', 'superadmin@waytocanada.ca');

        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name'              => 'Super Admin',
                'password'          => Hash::make(env('SUPER_ADMIN_PASSWORD', 'Admin@1234!')),
                'email_verified_at' => now(),
                'locale'            => 'en',
                'is_verified'       => true,
            ]
        );

        // Always ensure this account has the super-admin role (guard: sanctum)
        $superAdminRole = Role::findByName('super-admin', 'sanctum');
        $user->syncRoles([$superAdminRole]);

        $this->command->info("Super admin ready: {$email}");
    }
}
