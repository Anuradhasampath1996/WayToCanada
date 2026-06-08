<?php

namespace App\Services;

use App\Models\CrsRuleVersion;

class CrsRulesService
{
    public function activeRules(): array
    {
        $db = CrsRuleVersion::active();

        if ($db) {
            return array_merge(
                ['version' => $db->version, 'effective_date' => $db->effective_date->format('Y-m-d')],
                $db->rules ?? []
            );
        }

        return config('crs_rules');
    }

    public function meta(): array
    {
        $rules = $this->activeRules();

        return [
            'version'        => $rules['version'] ?? config('crs_rules.version'),
            'effective_date' => $rules['effective_date'] ?? config('crs_rules.effective_date'),
            'source_url'     => $rules['source_url'] ?? config('crs_rules.source_url'),
            'official_tool'  => $rules['official_tool'] ?? config('crs_rules.official_tool'),
            'changelog'      => $rules['changelog'] ?? config('crs_rules.changelog'),
            'policies'       => $rules['policies'] ?? config('crs_rules.policies'),
            'last_synced_at' => CrsRuleVersion::active()?->last_synced_at?->toIso8601String(),
        ];
    }
}
