<?php

namespace App\Services\Team;

class TeamPermissionCatalog
{
    /** @return list<string> */
    public function assignable(): array
    {
        return config('team.assignable', []);
    }

    /** @return list<string> */
    public function ownerOnly(): array
    {
        return config('team.owner_only', []);
    }

    /** @return array<string, array{name: string, permissions: list<string>}> */
    public function presets(): array
    {
        return config('team.presets', []);
    }

    public function isAssignable(string $key): bool
    {
        return in_array($key, $this->assignable(), true);
    }

    public function isOwnerOnly(string $key): bool
    {
        return in_array($key, $this->ownerOnly(), true);
    }

    /**
     * @param  array<string, mixed>|list<string>  $permissions
     * @return array<string, bool>
     */
    public function sanitize(array $permissions): array
    {
        $enabled = [];
        foreach ($permissions as $key => $value) {
            $permission = is_int($key) ? (string) $value : (string) $key;
            $on = is_int($key) ? true : (bool) $value;
            if ($on && $this->isAssignable($permission) && ! $this->isOwnerOnly($permission)) {
                $enabled[$permission] = true;
            }
        }

        return $enabled;
    }

    /**
     * @return array<string, bool>
     */
    public function fromPreset(string $key): array
    {
        $preset = $this->presets()[$key] ?? null;
        if (! $preset) {
            return [];
        }

        return $this->sanitize($preset['permissions'] ?? []);
    }

    /**
     * @param  array<string, bool>  $permissions
     * @return list<string>
     */
    public function enabledKeys(array $permissions): array
    {
        return array_keys(array_filter($permissions));
    }
}
