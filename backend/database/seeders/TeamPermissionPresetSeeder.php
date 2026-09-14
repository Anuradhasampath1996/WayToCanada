<?php

namespace Database\Seeders;

use App\Models\TeamPermissionPreset;
use App\Services\Team\TeamPermissionCatalog;
use Illuminate\Database\Seeder;

class TeamPermissionPresetSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = app(TeamPermissionCatalog::class);
        $descriptions = [
            'case_manager' => 'Broad case operations except licensed consultant finals.',
            'case_worker' => 'Day-to-day work on assigned cases.',
            'assistant' => 'Notes, tasks, calendar, and communications.',
            'document_specialist' => 'Documents and form preparation.',
            'billing_staff' => 'No platform billing in v1. Template only.',
            'read_only' => 'View-only access on scoped cases.',
        ];

        foreach ($catalog->presets() as $key => $preset) {
            TeamPermissionPreset::query()->updateOrCreate(
                ['key' => $key],
                [
                    'name' => $preset['name'],
                    'description' => $descriptions[$key] ?? null,
                    'permissions' => $catalog->fromPreset($key),
                ],
            );
        }
    }
}
