<?php

namespace Database\Seeders;

use App\Models\CaseFile;
use App\Models\ClientMeeting;
use App\Models\ClientProfile;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Sample July 2026 calendar meetings for anuradhasampath666@gmail.com
 * so the consultant dashboard calendar has a realistic month view —
 * including several days with 2–3 client meetings stacked.
 */
class ConsultantJuly2026CalendarSeeder extends Seeder
{
    public function run(): void
    {
        $consultant = User::where('email', 'anuradhasampath666@gmail.com')->first();
        if (! $consultant) {
            $this->command?->warn('Consultant anuradhasampath666@gmail.com not found — skip.');

            return;
        }

        $profiles = ClientProfile::with('user')
            ->where('consultant_id', $consultant->id)
            ->orderBy('id')
            ->get();

        if ($profiles->isEmpty()) {
            $this->command?->warn('No client profiles for consultant — skip.');

            return;
        }

        // Real portrait photos hosted on consultant dashboard (not AI letter avatars)
        $demoAvatars = [
            '/demo-avatars/client-1.jpg',
            '/demo-avatars/client-2.jpg',
            '/demo-avatars/client-3.jpg',
            '/demo-avatars/client-4.jpg',
        ];
        $demoLabels = [
            'Anuradha WP17',
            'Anuradha 999',
            'Anuradha 888',
            'Anuradha 61996',
        ];

        foreach ($profiles->values() as $idx => $profile) {
            $user = $profile->user;
            if (! $user) {
                continue;
            }
            $updates = [];

            // Always use local real portraits for this demo seed (no AI letter avatars)
            if (isset($demoAvatars[$idx])) {
                $updates['avatar'] = $demoAvatars[$idx];
            }

            if (isset($demoLabels[$idx]) && (
                strcasecmp(trim((string) $user->name), 'anuradha sampath') === 0
                || str_starts_with(trim((string) $user->name), 'Anuradha ')
            )) {
                $updates['name'] = $demoLabels[$idx];
            }
            if ($updates !== []) {
                $user->update($updates);
            }
        }

        $profiles = $profiles->fresh(['user']);

        // Clear previous demo meetings for this consultant in July 2026
        ClientMeeting::where('consultant_id', $consultant->id)
            ->where('scheduled_at', '>=', '2026-07-01 00:00:00')
            ->where('scheduled_at', '<', '2026-08-01 00:00:00')
            ->where('description', 'like', '%[demo-july-2026]%')
            ->delete();

        $tz = 'America/Toronto';

        // profile_idx picks which of the consultant's clients owns the meeting
        $plan = [
            // Jul 2 — 3 clients
            ['day' => 2,  'hour' => 9,  'min' => 0,  'dur' => 45, 'pi' => 0, 'title' => 'Discovery call', 'desc' => 'Initial consultation — goals & pathway overview'],
            ['day' => 2,  'hour' => 11, 'min' => 30, 'dur' => 30, 'pi' => 1, 'title' => 'Docs checklist', 'desc' => 'Confirm missing identity documents'],
            ['day' => 2,  'hour' => 15, 'min' => 0,  'dur' => 45, 'pi' => 2, 'title' => 'Pathway consult', 'desc' => 'Compare PNP vs Express Entry options'],

            // Jul 7 — 2 clients
            ['day' => 7,  'hour' => 10, 'min' => 0,  'dur' => 60, 'pi' => 1, 'title' => 'Document review', 'desc' => 'Review uploaded passport & education docs'],
            ['day' => 7,  'hour' => 14, 'min' => 30, 'dur' => 45, 'pi' => 3, 'title' => 'Quick follow-up', 'desc' => 'Status check and next steps'],

            // Jul 10 — 2 clients
            ['day' => 10, 'hour' => 11, 'min' => 0,  'dur' => 45, 'pi' => 2, 'title' => 'Pathway consultation', 'desc' => 'Provincial nominee shortlist'],
            ['day' => 10, 'hour' => 16, 'min' => 0,  'dur' => 30, 'pi' => 0, 'title' => 'File update call', 'desc' => 'Sync case notes after document upload'],

            // Jul 14 — single
            ['day' => 14, 'hour' => 9,  'min' => 30, 'dur' => 30, 'pi' => 3, 'title' => 'Quick follow-up', 'desc' => 'Clarify employment letter wording'],

            // Jul 16 — 3 clients (today)
            ['day' => 16, 'hour' => 10, 'min' => 0,  'dur' => 45, 'pi' => 0, 'title' => 'Client check-in', 'desc' => 'Mid-case progress review'],
            ['day' => 16, 'hour' => 13, 'min' => 0,  'dur' => 60, 'pi' => 1, 'title' => 'Forms walkthrough', 'desc' => 'IMM forms completeness check'],
            ['day' => 16, 'hour' => 16, 'min' => 30, 'dur' => 30, 'pi' => 2, 'title' => 'Status sync', 'desc' => 'IRCC portal status & next milestones'],

            // Jul 18 — 2 clients
            ['day' => 18, 'hour' => 11, 'min' => 0,  'dur' => 45, 'pi' => 1, 'title' => 'Package review', 'desc' => 'Forms & supporting letters walkthrough'],
            ['day' => 18, 'hour' => 15, 'min' => 0,  'dur' => 45, 'pi' => 3, 'title' => 'Letter of explanation', 'desc' => 'Draft LOE for gaps in history'],

            // Jul 21 — 3 clients
            ['day' => 21, 'hour' => 9,  'min' => 30, 'dur' => 60, 'pi' => 2, 'title' => 'Retainer discussion', 'desc' => 'Fee schedule and scope of services'],
            ['day' => 21, 'hour' => 12, 'min' => 0,  'dur' => 30, 'pi' => 0, 'title' => 'Docs chase-up', 'desc' => 'Outstanding bank statements'],
            ['day' => 21, 'hour' => 15, 'min' => 30, 'dur' => 45, 'pi' => 1, 'title' => 'Spouse docs review', 'desc' => 'Dependent document checklist'],

            // Jul 23 — 2 clients
            ['day' => 23, 'hour' => 14, 'min' => 0,  'dur' => 45, 'pi' => 3, 'title' => 'Docs submission review', 'desc' => 'Confirm outstanding document checklist'],
            ['day' => 23, 'hour' => 16, 'min' => 30, 'dur' => 30, 'pi' => 2, 'title' => 'Portal Q&A', 'desc' => 'Answer client portal questions'],

            // Jul 28 — 2 clients
            ['day' => 28, 'hour' => 10, 'min' => 0,  'dur' => 90, 'pi' => 0, 'title' => 'Final package review', 'desc' => 'Pre-submit quality check'],
            ['day' => 28, 'hour' => 14, 'min' => 30, 'dur' => 45, 'pi' => 1, 'title' => 'Submit readiness', 'desc' => 'Final fees & submission window'],

            // Jul 30 — single
            ['day' => 30, 'hour' => 14, 'min' => 0,  'dur' => 45, 'pi' => 1, 'title' => 'EE strategy session', 'desc' => 'CRS score and draw readiness'],
        ];

        $created = 0;
        foreach ($plan as $item) {
            $profile = $profiles[$item['pi'] % $profiles->count()];
            $caseFile = CaseFile::where('client_profile_id', $profile->id)
                ->orderByDesc('id')
                ->first();

            if (! $caseFile) {
                continue;
            }

            $scheduled = Carbon::create(2026, 7, $item['day'], $item['hour'], $item['min'], 0, $tz);

            ClientMeeting::create([
                'token'             => Str::random(48),
                'case_file_id'      => $caseFile->id,
                'client_profile_id' => $profile->id,
                'consultant_id'     => $consultant->id,
                'title'             => $item['title'],
                'description'       => $item['desc']."\n\n[demo-july-2026]",
                'scheduled_at'      => $scheduled->utc(),
                'duration_minutes'  => $item['dur'],
                'timezone'          => $tz,
                'provider'          => 'google_meet',
                'meeting_url'       => 'https://meet.google.com/demo-wtc-'.Str::lower(Str::random(6)),
                'status'            => 'scheduled',
                'sent_at'           => now(),
            ]);
            $created++;
        }

        // Spread retainer milestones across July for green events
        $retainerDays = [5, 12, 25];
        foreach ($profiles->values() as $idx => $profile) {
            if (! isset($retainerDays[$idx])) {
                break;
            }
            $caseFile = CaseFile::where('client_profile_id', $profile->id)->orderByDesc('id')->first();
            if (! $caseFile) {
                continue;
            }
            $signed = Carbon::create(2026, 7, $retainerDays[$idx], 12, 0, 0, $tz);
            $caseFile->update([
                'agreement_signed_at' => $signed->utc(),
                'status'              => $caseFile->status === 'PENDING_ASSESSMENT' ? 'AGREEMENT_SIGNED' : $caseFile->status,
            ]);
        }

        $this->command?->info("Seeded {$created} July 2026 demo meetings for {$consultant->email}.");
    }
}
