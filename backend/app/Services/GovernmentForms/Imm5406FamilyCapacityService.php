<?php

namespace App\Services\GovernmentForms;

use App\Data\GovernmentForms\CanonicalDataSet;

class Imm5406FamilyCapacityService
{
    public const CHILD_SLOTS = 3;

    public const SIBLING_SLOTS = 3;

    public const PARENT_SLOTS = 2;

    /**
     * @return array{blocked: bool, warnings: list<array{section: string, count: int, capacity: int, label: string, message: string}>}
     */
    public function assess(CanonicalDataSet $canonical): array
    {
        $childrenCount = $this->countIndexedMembers($canonical, 'applicant.family.children');
        $siblingsCount = $this->countIndexedMembers($canonical, 'applicant.family.siblings');
        $parentOverflow = $this->countIndexedMembers($canonical, 'applicant.family.parents_overflow');

        $warnings = [];

        if ($childrenCount > self::CHILD_SLOTS) {
            $warnings[] = $this->warning(
                'children',
                $childrenCount,
                self::CHILD_SLOTS,
                'Dependent children',
                sprintf(
                    'IMM 5406 supports %d child rows; %d children are in the questionnaire. Remove or consolidate entries before generating.',
                    self::CHILD_SLOTS,
                    $childrenCount,
                ),
            );
        }

        if ($siblingsCount > self::SIBLING_SLOTS) {
            $warnings[] = $this->warning(
                'siblings',
                $siblingsCount,
                self::SIBLING_SLOTS,
                'Siblings / other family',
                sprintf(
                    'IMM 5406 supports %d sibling/other-family rows; %d entries were found. Remove or consolidate entries before generating.',
                    self::SIBLING_SLOTS,
                    $siblingsCount,
                ),
            );
        }

        if ($parentOverflow > 0) {
            $warnings[] = $this->warning(
                'parents',
                self::PARENT_SLOTS + $parentOverflow,
                self::PARENT_SLOTS,
                'Parents',
                sprintf(
                    'IMM 5406 supports %d parent rows (Parent1/Parent2); %d parent entries were found in accompanying persons.',
                    self::PARENT_SLOTS,
                    self::PARENT_SLOTS + $parentOverflow,
                ),
            );
        }

        return [
            'blocked'  => $warnings !== [],
            'warnings' => $warnings,
        ];
    }

    private function countIndexedMembers(CanonicalDataSet $canonical, string $prefix): int
    {
        $maxIndex = -1;

        foreach (array_keys($canonical->values) as $key) {
            if (! preg_match('/^'.preg_quote($prefix, '/').'\.(\d+)\./', $key, $matches)) {
                continue;
            }

            $index = (int) $matches[1];
            if ($index > $maxIndex) {
                $maxIndex = $index;
            }
        }

        return $maxIndex + 1;
    }

    /** @return array{section: string, count: int, capacity: int, label: string, message: string} */
    private function warning(string $section, int $count, int $capacity, string $label, string $message): array
    {
        return [
            'section'  => $section,
            'count'    => $count,
            'capacity' => $capacity,
            'label'    => $label,
            'message'  => $message,
        ];
    }
}
