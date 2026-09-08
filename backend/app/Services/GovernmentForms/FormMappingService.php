<?php

namespace App\Services\GovernmentForms;

use App\Models\GovernmentFormMapping;
use App\Models\GovernmentFormVersion;
use App\Services\GovernmentForms\Transformers\FieldTransformerRegistry;
use Illuminate\Support\Collection;

class FormMappingService
{
    public function __construct(
        private FieldTransformerRegistry $transformers,
    ) {}

    /**
     * @param  array<string, mixed>  $canonicalValues
     * @return array<string, mixed>  pdf_field_path => transformed value
     */
    public function mapToPdfFields(GovernmentFormVersion $version, array $canonicalValues): array
    {
        $mappings = $version->mappings()->orderBy('sort_order')->get();
        $mapped = [];

        foreach ($mappings as $mapping) {
            $value = $canonicalValues[$mapping->canonical_key] ?? null;

            if ($value === null || $value === '') {
                continue;
            }

            $transformed = $this->transformers->transform(
                $mapping->transformer,
                $value,
                ['field_type' => $mapping->field_type, 'form_code' => $version->form_code],
            );

            if ($transformed !== null && $transformed !== '') {
                $mapped[$mapping->pdf_field_path] = (string) $transformed;
            }
        }

        return $mapped;
    }

    /** @return Collection<int, GovernmentFormMapping> */
    public function requiredMappings(GovernmentFormVersion $version): Collection
    {
        return $version->mappings()->where('is_required', true)->orderBy('sort_order')->get();
    }
}
