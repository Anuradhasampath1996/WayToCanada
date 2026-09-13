<?php

namespace App\Support;

final class RequirementPlanDiff
{
    /**
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $proposed
     * @return array<string, mixed>
     */
    public static function compare(array $current, array $proposed): array
    {
        $currentFields = self::indexBy($current['extra_fields'] ?? [], 'key');
        $proposedFields = self::indexBy($proposed['extra_fields'] ?? [], 'key');
        $currentForms = self::indexBy($current['forms'] ?? [], 'code');
        $proposedForms = self::indexBy($proposed['forms'] ?? [], 'code');
        $currentDocs = self::indexBy($current['documents'] ?? [], 'id');
        $proposedDocs = self::indexBy($proposed['documents'] ?? [], 'id');

        return [
            'added_fields' => array_values(array_diff_key($proposedFields, $currentFields)),
            'removed_fields' => array_values(array_diff_key($currentFields, $proposedFields)),
            'added_forms' => array_values(array_diff_key($proposedForms, $currentForms)),
            'removed_forms' => array_values(array_diff_key($currentForms, $proposedForms)),
            'changed_forms' => self::changed($currentForms, $proposedForms, ['name', 'kind']),
            'added_documents' => array_values(array_diff_key($proposedDocs, $currentDocs)),
            'removed_documents' => array_values(array_diff_key($currentDocs, $proposedDocs)),
            'changed_documents' => self::changed($currentDocs, $proposedDocs, ['label', 'category']),
            'representative' => [
                'from' => $current['representative']['status'] ?? null,
                'to' => $proposed['representative']['status'] ?? null,
                'changed' => ($current['representative']['status'] ?? null) !== ($proposed['representative']['status'] ?? null),
            ],
            'portals' => [
                'from' => $current['portals']['recommended'] ?? [],
                'to' => $proposed['portals']['recommended'] ?? [],
                'changed' => ($current['portals']['recommended'] ?? []) !== ($proposed['portals']['recommended'] ?? []),
            ],
        ];
    }

    /**
     * Non-destructive merge: reuse compatible items; leftover current items become obsolete.
     *
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $proposed
     * @return array<string, mixed>
     */
    public static function mergePreservingHistory(array $current, array $proposed): array
    {
        $merged = $proposed;
        $merged['extra_fields'] = self::mergeList($current['extra_fields'] ?? [], $proposed['extra_fields'] ?? [], 'key');
        $merged['forms'] = self::mergeList($current['forms'] ?? [], $proposed['forms'] ?? [], 'code');
        $merged['documents'] = self::mergeList($current['documents'] ?? [], $proposed['documents'] ?? [], 'id', 'requested');
        $merged['obsolete_items'] = array_values(array_merge(
            $current['obsolete_items'] ?? [],
            self::obsoleteFrom($current['extra_fields'] ?? [], $proposed['extra_fields'] ?? [], 'key', 'field'),
            self::obsoleteFrom($current['forms'] ?? [], $proposed['forms'] ?? [], 'code', 'form'),
            self::obsoleteFrom($current['documents'] ?? [], $proposed['documents'] ?? [], 'id', 'document'),
        ));

        if (isset($current['portals']['confirmed'])) {
            $merged['portals']['confirmed'] = $current['portals']['confirmed'];
        }

        return $merged;
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return array<string, array<string, mixed>>
     */
    private static function indexBy(array $items, string $key): array
    {
        $out = [];
        foreach ($items as $item) {
            if (! isset($item[$key])) {
                continue;
            }
            $out[(string) $item[$key]] = $item;
        }

        return $out;
    }

    /**
     * @param  array<string, array<string, mixed>>  $current
     * @param  array<string, array<string, mixed>>  $proposed
     * @param  list<string>  $fields
     * @return list<array{key: string, from: mixed, to: mixed}>
     */
    private static function changed(array $current, array $proposed, array $fields): array
    {
        $changes = [];
        foreach ($proposed as $key => $item) {
            if (! isset($current[$key])) {
                continue;
            }
            foreach ($fields as $field) {
                if (($current[$key][$field] ?? null) !== ($item[$field] ?? null)) {
                    $changes[] = [
                        'key' => $key,
                        'field' => $field,
                        'from' => $current[$key][$field] ?? null,
                        'to' => $item[$field] ?? null,
                    ];
                }
            }
        }

        return $changes;
    }

    /**
     * @param  list<array<string, mixed>>  $current
     * @param  list<array<string, mixed>>  $proposed
     * @return list<array<string, mixed>>
     */
    private static function mergeList(array $current, array $proposed, string $key, string $defaultNewStatus = 'pending'): array
    {
        $currentBy = self::indexBy($current, $key);
        $out = [];
        foreach ($proposed as $item) {
            $id = (string) ($item[$key] ?? '');
            if ($id !== '' && isset($currentBy[$id])) {
                $prev = $currentBy[$id];
                $prevValue = $prev['value'] ?? null;
                $newValue = $item['value'] ?? null;
                if (self::hasValue($prevValue)) {
                    $item['value'] = $prevValue;
                    $item['status'] = $prev['status'] ?? $item['status'] ?? $defaultNewStatus;
                } elseif (self::hasValue($newValue)) {
                    $item['value'] = $newValue;
                    $item['status'] = $item['status'] ?? 'reused';
                } else {
                    $item['status'] = $prev['status'] ?? $item['status'] ?? $defaultNewStatus;
                }
                if (! empty($prev['reuse_candidate']) && empty($item['reuse_candidate'])) {
                    $item['reuse_candidate'] = $prev['reuse_candidate'];
                }
                if (isset($prev['answered_at'])) {
                    $item['answered_at'] = $prev['answered_at'];
                }
                if (isset($prev['answered_by'])) {
                    $item['answered_by'] = $prev['answered_by'];
                }
            } else {
                $item['status'] = $item['status'] ?? $defaultNewStatus;
            }
            $out[] = $item;
        }

        return $out;
    }

    private static function hasValue(mixed $value): bool
    {
        if (is_array($value)) {
            return $value !== [];
        }

        return trim((string) $value) !== '';
    }

    /**
     * @param  list<array<string, mixed>>  $current
     * @param  list<array<string, mixed>>  $proposed
     * @return list<array<string, mixed>>
     */
    private static function obsoleteFrom(array $current, array $proposed, string $key, string $kind): array
    {
        $proposedBy = self::indexBy($proposed, $key);
        $obsolete = [];
        foreach ($current as $item) {
            $id = (string) ($item[$key] ?? '');
            if ($id === '' || isset($proposedBy[$id])) {
                continue;
            }
            $item['status'] = 'obsolete';
            $item['requirement_state'] = 'not_required';
            $item['kind'] = $kind;
            $obsolete[] = $item;
        }

        return $obsolete;
    }
}
