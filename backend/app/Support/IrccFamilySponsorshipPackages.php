<?php

namespace App\Support;

use App\Models\IrccCategory;

/**
 * Non-destructive upsert for Family Sponsorship IRCC package leaves.
 * Never truncates the category tree.
 */
final class IrccFamilySponsorshipPackages
{
    /** @return list<array{label: string, result: array<string, mixed>}> */
    public static function leafDefinitions(): array
    {
        return [
            [
                'label' => 'Family Sponsorship — Spouse or Partner',
                'result' => [
                    'guide' => 'Guide 3999',
                    'checklist' => 'IMM 5533',
                    'forms' => ['IMM 0008', 'IMM 5669', 'IMM 1344', 'IMM 5481'],
                ],
            ],
            [
                'label' => 'Family Sponsorship — Parents and Grandparents',
                'result' => [
                    'guide' => 'Guide 5772',
                    'checklist' => 'IMM 5771',
                    'forms' => ['IMM 0008', 'IMM 5669', 'IMM 1344'],
                ],
            ],
        ];
    }

    /**
     * @return array{parent_id: ?int, created: list<string>, updated: list<string>, skipped: list<string>}
     */
    public static function ensure(): array
    {
        $parent = IrccCategory::query()
            ->where('level', 2)
            ->where('label', 'To immigrate to Canada (Permanent Residence)')
            ->first();

        if (! $parent) {
            return [
                'parent_id' => null,
                'created' => [],
                'updated' => [],
                'skipped' => ['Permanent Residence parent category missing'],
            ];
        }

        $maxSort = (int) IrccCategory::query()
            ->where('parent_id', $parent->id)
            ->max('sort_order');

        $created = [];
        $updated = [];
        $skipped = [];

        foreach (self::leafDefinitions() as $index => $def) {
            $existing = IrccCategory::query()
                ->where('parent_id', $parent->id)
                ->where('label', $def['label'])
                ->first();

            if ($existing) {
                $existing->update([
                    'level' => 3,
                    'result' => $def['result'],
                ]);
                $updated[] = $def['label'];
                continue;
            }

            // Also adopt orphans with the same label under a different parent.
            $orphan = IrccCategory::query()
                ->where('level', 3)
                ->where('label', $def['label'])
                ->first();

            if ($orphan) {
                $orphan->update([
                    'parent_id' => $parent->id,
                    'result' => $def['result'],
                ]);
                $updated[] = $def['label'].' (reparented)';
                continue;
            }

            IrccCategory::create([
                'parent_id' => $parent->id,
                'level' => 3,
                'label' => $def['label'],
                'result' => $def['result'],
                'sort_order' => $maxSort + $index + 1,
            ]);
            $created[] = $def['label'];
        }

        return [
            'parent_id' => $parent->id,
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
        ];
    }
}
