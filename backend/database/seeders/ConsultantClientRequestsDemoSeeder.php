<?php

namespace Database\Seeders;

use App\Models\ClientProfile;
use App\Models\ConsultantClientRequest;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Pending client requests for anuradhasampath666@gmail.com
 * so /dashboard/client-requests has realistic sample data.
 */
class ConsultantClientRequestsDemoSeeder extends Seeder
{
    public function run(): void
    {
        $consultant = User::where('email', 'anuradhasampath666@gmail.com')->first();
        if (! $consultant) {
            $this->command?->warn('Consultant anuradhasampath666@gmail.com not found — skip.');

            return;
        }

        $demoClients = [
            [
                'email'   => 'demo.request.nimal@example.com',
                'name'    => 'Nimal Perera',
                'phone'   => '+1 416 555 2101',
                'message' => 'Hi — I am exploring Express Entry and would like your guidance on my CRS readiness.',
                'avatar'  => '/demo-avatars/client-1.jpg',
                'hours'   => 2,
            ],
            [
                'email'   => 'demo.request.samantha@example.com',
                'name'    => 'Samantha Fernando',
                'phone'   => '+1 647 555 8832',
                'message' => 'Looking for an RCIC for a Study Permit extension and PGWP pathway advice.',
                'avatar'  => '/demo-avatars/client-2.jpg',
                'hours'   => 8,
            ],
            [
                'email'   => 'demo.request.kasun@example.com',
                'name'    => 'Kasun Jayawardena',
                'phone'   => '+94 77 555 0199',
                'message' => 'I work in IT and want to discuss PNP options for Ontario. Can we book a discovery call?',
                'avatar'  => '/demo-avatars/client-3.jpg',
                'hours'   => 26,
            ],
            [
                'email'   => 'demo.request.dilani@example.com',
                'name'    => 'Dilani Wickramasinghe',
                'phone'   => '+1 905 555 4470',
                'message' => 'My spouse and I need help preparing a family sponsorship package. Requesting representation.',
                'avatar'  => '/demo-avatars/client-4.jpg',
                'hours'   => 40,
            ],
            [
                'email'   => 'demo.request.arjun@example.com',
                'name'    => 'Arjun Mehta',
                'phone'   => '+1 514 555 7761',
                'message' => null,
                'avatar'  => null,
                'hours'   => 5,
            ],
        ];

        // Clear previous demo pending requests for this consultant
        $demoEmails = collect($demoClients)->pluck('email');
        $demoUserIds = User::whereIn('email', $demoEmails)->pluck('id');

        ConsultantClientRequest::where('consultant_id', $consultant->id)
            ->whereIn('client_user_id', $demoUserIds)
            ->delete();

        $created = 0;
        foreach ($demoClients as $item) {
            $user = User::firstOrCreate(
                ['email' => $item['email']],
                [
                    'name'              => $item['name'],
                    'phone'             => $item['phone'],
                    'password'          => Hash::make('Password123!'),
                    'avatar'            => $item['avatar'],
                    'email_verified_at' => now(),
                    'is_verified'       => true,
                ]
            );

            $user->update([
                'name'        => $item['name'],
                'phone'       => $item['phone'],
                'avatar'      => $item['avatar'],
                'consultant_id' => null,
            ]);

            if (! $user->hasRole('client')) {
                $user->assignRole('client');
            }

            // These demo requesters must not already be assigned
            ClientProfile::where('user_id', $user->id)->delete();

            $request = ConsultantClientRequest::create([
                'client_user_id' => $user->id,
                'consultant_id'  => $consultant->id,
                'status'         => ConsultantClientRequest::STATUS_PENDING,
                'message'        => $item['message'],
                'created_at'     => now()->subHours($item['hours']),
                'updated_at'     => now()->subHours($item['hours']),
            ]);

            // Ensure created_at sticks (Eloquent may overwrite)
            $request->forceFill([
                'created_at' => now()->subHours($item['hours']),
                'updated_at' => now()->subHours($item['hours']),
            ])->saveQuietly();

            $created++;
        }

        $this->command?->info("Seeded {$created} pending client requests for {$consultant->email}.");
    }
}
