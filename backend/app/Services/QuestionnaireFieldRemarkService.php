<?php

namespace App\Services;

use App\Models\QuestionnaireSubmission;

class QuestionnaireFieldRemarkService
{
    private const SECTION_KEYS = [
        'step1_data',
        'main_data',
        'spouse_data',
        'children_data',
        'accompanying_data',
        'step3_data',
    ];

    /** Keys that mean the same questionnaire field (remark key ↔ client form key). */
    private const FIELD_ALIASES = [
        'spouse_data.fullName' => ['spouse_data.passportFullName', 'spouse_data.name'],
        'spouse_data.passportFullName' => ['spouse_data.fullName', 'spouse_data.name'],
        'main_data.fullName' => ['main_data.passportFullName'],
        'main_data.passportFullName' => ['main_data.fullName'],
        'accompanying_data.parent1.fullName' => ['accompanying_data.parent1.passportFullName'],
        'accompanying_data.parent1.passportFullName' => ['accompanying_data.parent1.fullName'],
        'accompanying_data.parent2.fullName' => ['accompanying_data.parent2.passportFullName'],
        'accompanying_data.parent2.passportFullName' => ['accompanying_data.parent2.fullName'],
    ];

    /**
     * Snapshot the current field value when a consultant requests a refill.
     *
     * @param  array<string, mixed>  $remark
     * @return array<string, mixed>
     */
    public function withValueAtRequest(QuestionnaireSubmission $submission, string $fieldKey, array $remark): array
    {
        $remark['value_at_request'] = $this->normalizeValue($this->valueAt($submission, $fieldKey));

        return $remark;
    }

    /**
     * Mark pending remarks resolved when the client (or consultant) changes the flagged field.
     *
     * @param  array<string, mixed>  $incoming  Validated upsert payload sections
     * @return array{0: array<string, mixed>, 1: list<string>}  [remarks, resolvedKeys]
     */
    public function resolveChangedRemarks(QuestionnaireSubmission $before, array $incoming): array
    {
        $remarks = $before->field_remarks ?? [];
        if ($remarks === []) {
            return [$remarks, []];
        }

        $after = $this->mergedSnapshot($before, $incoming);
        $resolvedKeys = [];

        foreach ($remarks as $fieldKey => $remark) {
            if (! is_array($remark) || ($remark['status'] ?? '') !== 'pending') {
                continue;
            }

            $newValue = $this->normalizeValue($this->valueAtPath($after, $fieldKey));
            $baseline = array_key_exists('value_at_request', $remark)
                ? $this->normalizeValue($remark['value_at_request'])
                : $this->normalizeValue($this->valueAt($before, $fieldKey));

            // Also accept changes on alias keys (e.g. spouse fullName ↔ passportFullName).
            if ($newValue === $baseline) {
                foreach ($this->aliasKeys($fieldKey) as $alias) {
                    $aliasNew = $this->normalizeValue($this->valueAtPath($after, $alias));
                    $aliasOld = $this->normalizeValue($this->valueAt($before, $alias));
                    if ($aliasNew !== $aliasOld && $aliasNew !== $baseline) {
                        $newValue = $aliasNew;
                        break;
                    }
                    if ($aliasNew !== $baseline && $aliasNew !== '') {
                        $newValue = $aliasNew;
                        break;
                    }
                }
            }

            if ($newValue === $baseline) {
                continue;
            }

            $remarks[$fieldKey] = array_merge($remark, [
                'status'      => 'resolved',
                'resolved_at' => now()->toIso8601String(),
            ]);
            $resolvedKeys[] = $fieldKey;
        }

        return [$remarks, $resolvedKeys];
    }

    /**
     * Resolve a single pending remark after a targeted field update.
     *
     * @return array<string, mixed>
     */
    public function resolveIfPending(QuestionnaireSubmission $submission, string $fieldKey): array
    {
        $remarks = $submission->field_remarks ?? [];
        $keys = array_unique([$fieldKey, ...$this->aliasKeys($fieldKey)]);

        foreach ($keys as $key) {
            $remark = $remarks[$key] ?? null;
            if (! is_array($remark) || ($remark['status'] ?? '') !== 'pending') {
                continue;
            }
            $remarks[$key] = array_merge($remark, [
                'status'      => 'resolved',
                'resolved_at' => now()->toIso8601String(),
            ]);
        }

        return $remarks;
    }

    /** @return list<string> */
    private function aliasKeys(string $fieldKey): array
    {
        return self::FIELD_ALIASES[$fieldKey] ?? [];
    }

    /**
     * @param  array<string, mixed>  $incoming
     * @return array<string, mixed>
     */
    private function mergedSnapshot(QuestionnaireSubmission $before, array $incoming): array
    {
        $snapshot = [];
        foreach (self::SECTION_KEYS as $section) {
            $snapshot[$section] = array_key_exists($section, $incoming)
                ? $incoming[$section]
                : ($before->{$section} ?? null);
        }

        return $snapshot;
    }

    private function valueAt(QuestionnaireSubmission $submission, string $fieldKey): mixed
    {
        $parts = explode('.', $fieldKey);
        $section = array_shift($parts);
        if ($section === null || $section === '' || $parts === []) {
            return null;
        }

        return data_get($submission->{$section} ?? null, implode('.', $parts));
    }

    /** @param  array<string, mixed>  $snapshot */
    private function valueAtPath(array $snapshot, string $fieldKey): mixed
    {
        return data_get($snapshot, $fieldKey);
    }

    private function normalizeValue(mixed $value): string
    {
        if ($value === null) {
            return '';
        }
        if (is_bool($value)) {
            return $value ? '1' : '0';
        }
        if (is_scalar($value)) {
            return trim((string) $value);
        }
        if (is_array($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE) ?: '';
        }

        return '';
    }
}
