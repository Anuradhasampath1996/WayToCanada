<?php

namespace Database\Seeders;

use App\Models\PathwayRequirementDefinition;
use App\Support\PathwayRequirementCatalog;
use Illuminate\Database\Seeder;

/**
 * Versioned Pathway Requirement Registry (Phase 0).
 * Safe to re-run: upserts the current catalog version only. Never edits case snapshots.
 */
class PathwayRequirementRegistrySeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        foreach (PathwayRequirementCatalog::definitions() as $key => $definition) {
            PathwayRequirementDefinition::query()->updateOrCreate(
                [
                    'registry_key' => $key,
                    'version' => PathwayRequirementCatalog::VERSION,
                ],
                [
                    'family' => $definition['family'] ?? ($key === 'default' ? null : $key),
                    'effective_from' => $now->copy()->subMinute(),
                    'effective_to' => null,
                    'source_name' => PathwayRequirementCatalog::SOURCE_NAME,
                    'source_reference' => PathwayRequirementCatalog::SOURCE_REFERENCE,
                    'last_verified_at' => $now,
                    'definition' => $definition,
                    'is_published' => true,
                ]
            );
        }
    }
}
