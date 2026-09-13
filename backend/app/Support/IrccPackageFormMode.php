<?php

namespace App\Support;

use App\Models\IrccCategory;
use App\Services\IrccInteractiveFormSyncService;

final class IrccPackageFormMode
{
    /**
     * @param  iterable<int, mixed>  $interactiveForms
     * @return array{
     *   form_mode: 'interactive'|'pdf_only'|'none',
     *   package_label: ?string,
     *   reference_forms: list<array{code: string, name: string}>
     * }
     */
    public static function describe(?IrccCategory $category, iterable $interactiveForms): array
    {
        $forms = is_countable($interactiveForms)
            ? count($interactiveForms)
            : iterator_count($interactiveForms);

        $referenceForms = self::referenceFormsForCategory($category);

        return [
            'package_label'   => $category?->label,
            'form_mode'       => $forms > 0
                ? 'interactive'
                : ($referenceForms !== [] ? 'pdf_only' : 'none'),
            'reference_forms' => $referenceForms,
        ];
    }

    /** @return list<array{code: string, name: string}> */
    public static function referenceFormsForCategory(?IrccCategory $category): array
    {
        if (! $category || empty($category->result['forms'])) {
            return [];
        }

        $refs = [];

        foreach ($category->result['forms'] as $code) {
            if (! is_string($code) || $code === '') {
                continue;
            }

            if (in_array(strtolower(trim($code)), ['none', 'n/a'], true)) {
                continue;
            }

            if (IrccInteractiveFormSyncService::isOnlineOnlyReference($code)) {
                continue;
            }

            $refs[] = [
                'code' => $code,
                'name' => self::referenceFormName($code),
            ];
        }

        return $refs;
    }

    public static function referenceFormName(string $code): string
    {
        return match ($code) {
            'IMM 5710' => 'Application to Change Conditions, Extend Stay or Remain in Canada as a Worker',
            'IMM 0008' => 'Generic Application Form for Canada',
            'IMM 5669' => 'Schedule A — Background/Declaration',
            'IMM 5406' => 'Additional Family Information',
            'IMM 5476' => 'Use of a Representative',
            'IMM 5257' => 'Temporary Resident Visa application',
            'IMM 5645' => 'Family Information',
            'IMM 1295' => 'Application for Work Permit Made Outside Canada',
            'IMM 1294' => 'Application for Study Permit Made Outside Canada',
            'IMM 5707' => 'Family Information',
            default    => 'IRCC form '.$code,
        };
    }
}
